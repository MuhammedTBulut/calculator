package parser_test

import (
	"errors"
	"testing"

	"github.com/MuhammedTBulut/calculator/backend/internal/apperror"
	"github.com/MuhammedTBulut/calculator/backend/internal/calculator"
	"github.com/MuhammedTBulut/calculator/backend/internal/parser"
)

// newRegistry wires the real operations, exactly as the composition root will.
func newRegistry(t testing.TB) calculator.Registry {
	t.Helper()
	reg, err := calculator.NewRegistry(
		calculator.Add{}, calculator.Subtract{}, calculator.Multiply{},
		calculator.Divide{}, calculator.Power{}, calculator.Sqrt{},
		calculator.Percent{},
	)
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	return reg
}

func newEvaluator(t testing.TB) *parser.Evaluator {
	t.Helper()
	eval, err := parser.NewEvaluator(newRegistry(t))
	if err != nil {
		t.Fatalf("NewEvaluator: %v", err)
	}
	return eval
}

func TestEvaluate(t *testing.T) {
	eval := newEvaluator(t)

	tests := []struct {
		name    string
		input   string
		want    float64
		wantErr error
	}{
		// Precedence and associativity.
		{name: "multiplication before addition", input: "2+3*4", want: 14},
		{name: "parentheses override precedence", input: "(2+3)*4", want: 20},
		{name: "power is right-associative", input: "2^3^2", want: 512},
		{name: "subtraction is left-associative", input: "8-3-2", want: 3},

		// Unary minus.
		{name: "unary minus binds looser than power", input: "-3^2", want: -9},
		{name: "parenthesized negation squared", input: "(-3)^2", want: 9},
		{name: "unary minus after multiply", input: "2*-3", want: -6},
		{name: "binary minus then unary minus", input: "2--3", want: 5},
		{name: "negative exponent", input: "2^-1", want: 0.5},

		// Functions.
		{name: "sqrt", input: "sqrt(16)", want: 4},
		{name: "nested sqrt", input: "sqrt(sqrt(16))", want: 2},
		{name: "sqrt inside expression", input: "2*sqrt(9)+1", want: 7},

		// Percent.
		{name: "postfix percent", input: "50%", want: 0.5},
		{name: "percent binds tighter than addition", input: "50%+10", want: 10.5},
		{name: "percent of a value via multiply", input: "200*50%", want: 100},

		// Decimals and whitespace.
		{name: "decimals", input: "1.5+2.25", want: 3.75},
		{name: "leading-dot decimal", input: ".5*4", want: 2},
		{name: "whitespace tolerated", input: " 2 + 3 ", want: 5},

		// Domain errors surface typed, not generic.
		{name: "division by zero inside expression", input: "10/(5-5)", wantErr: apperror.ErrDivisionByZero},
		{name: "sqrt of negative", input: "sqrt(-1)", wantErr: apperror.ErrNegativeSqrt},
		{name: "overflow propagates", input: "10^308*10", wantErr: apperror.ErrOverflow},

		// Unknown function — reported regardless of evaluation order, so an
		// expression's validity never depends on which error fires first.
		{name: "unknown function", input: "foo(4)", wantErr: apperror.ErrUnknownFunction},
		{name: "unknown function before domain error", input: "foo(4)+1/0", wantErr: apperror.ErrUnknownFunction},
		{name: "unknown function after domain error", input: "1/0+foo(4)", wantErr: apperror.ErrUnknownFunction},

		// Permissive chaining — unambiguous, so accepted by design.
		{name: "double unary minus", input: "--3", want: 3},
		{name: "chained percent", input: "50%%", want: 0.005},

		// Malformed input.
		{name: "empty string", input: "", wantErr: apperror.ErrSyntax},
		{name: "whitespace only", input: "   ", wantErr: apperror.ErrSyntax},
		{name: "doubled operator", input: "2++3", wantErr: apperror.ErrSyntax},
		{name: "dangling open paren", input: "(2+", wantErr: apperror.ErrSyntax},
		{name: "double dot number", input: "1.2.3", wantErr: apperror.ErrSyntax},
		{name: "unexpected character", input: "2$3", wantErr: apperror.ErrSyntax},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := eval.Evaluate(tc.input)
			if tc.wantErr != nil {
				if !errors.Is(err, tc.wantErr) {
					t.Fatalf("Evaluate(%q) error = %v, want %v", tc.input, err, tc.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("Evaluate(%q) unexpected error: %v", tc.input, err)
			}
			if got != tc.want {
				t.Fatalf("Evaluate(%q) = %g, want %g", tc.input, got, tc.want)
			}
		})
	}
}

// TestEvaluateSyntaxPositions pins the byte positions the API layer will
// forward to the UI for underlining the failing character.
func TestEvaluateSyntaxPositions(t *testing.T) {
	eval := newEvaluator(t)

	tests := []struct {
		input   string
		wantPos int
	}{
		{input: "2++3", wantPos: 2},
		{input: "(2+", wantPos: 3},
		{input: "2+3)", wantPos: 3},
		{input: "2$3", wantPos: 1},
		{input: "", wantPos: 0},
		{input: "sqrt+2", wantPos: 4},
		{input: "1.2.3", wantPos: 3},
	}

	for _, tc := range tests {
		t.Run(tc.input, func(t *testing.T) {
			_, err := eval.Evaluate(tc.input)
			var synErr *apperror.SyntaxError
			if !errors.As(err, &synErr) {
				t.Fatalf("Evaluate(%q) error = %v, want *apperror.SyntaxError", tc.input, err)
			}
			if synErr.Position != tc.wantPos {
				t.Fatalf("Evaluate(%q) position = %d, want %d (%s)", tc.input, synErr.Position, tc.wantPos, synErr.Reason)
			}
		})
	}
}

// TestEvaluateUnknownFunctionPrecision pins the same precision for an
// unrecognized identifier as TestEvaluateSyntaxPositions pins for a syntax
// fault: the exact name and the exact byte position of its first character,
// regardless of where in the expression it appears or what surrounds it.
func TestEvaluateUnknownFunctionPrecision(t *testing.T) {
	eval := newEvaluator(t)

	tests := []struct {
		input    string
		wantPos  int
		wantName string
	}{
		{input: "foo(4)", wantPos: 0, wantName: "foo"},
		{input: "1+bar(2)", wantPos: 2, wantName: "bar"},
		{input: "sqrt(baz(1))", wantPos: 5, wantName: "baz"},
		{input: "foo(4)+1/0", wantPos: 0, wantName: "foo"},
		{input: "1/0+foo(4)", wantPos: 4, wantName: "foo"},
	}

	for _, tc := range tests {
		t.Run(tc.input, func(t *testing.T) {
			_, err := eval.Evaluate(tc.input)
			var unknownErr *apperror.UnknownFunctionError
			if !errors.As(err, &unknownErr) {
				t.Fatalf("Evaluate(%q) error = %v, want *apperror.UnknownFunctionError", tc.input, err)
			}
			if unknownErr.Name != tc.wantName {
				t.Fatalf("Evaluate(%q) name = %q, want %q", tc.input, unknownErr.Name, tc.wantName)
			}
			if unknownErr.Position != tc.wantPos {
				t.Fatalf("Evaluate(%q) position = %d, want %d", tc.input, unknownErr.Position, tc.wantPos)
			}
			if !errors.Is(err, apperror.ErrUnknownFunction) {
				t.Fatalf("Evaluate(%q) does not satisfy errors.Is(err, ErrUnknownFunction)", tc.input)
			}
		})
	}
}
