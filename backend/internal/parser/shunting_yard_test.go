package parser

import (
	"errors"
	"strings"
	"testing"

	"github.com/MuhammedTBulut/calculator/backend/internal/apperror"
)

// rpnString renders an RPN token sequence for compact table expectations.
func rpnString(t *testing.T, input string) (string, error) {
	t.Helper()
	tokens, err := tokenize(input)
	if err != nil {
		return "", err
	}
	rpn, err := toRPN(tokens, len(input))
	if err != nil {
		return "", err
	}
	parts := make([]string, len(rpn))
	for i, tok := range rpn {
		parts[i] = tok.text
	}
	return strings.Join(parts, " "), nil
}

func TestToRPN(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{name: "precedence multiply over add", input: "2+3*4", want: "2 3 4 * +"},
		{name: "parentheses override precedence", input: "(2+3)*4", want: "2 3 + 4 *"},
		{name: "power is right-associative", input: "2^3^2", want: "2 3 2 ^ ^"},
		{name: "same-precedence left association", input: "8-3-2", want: "8 3 - 2 -"},
		{name: "unary minus binds looser than power", input: "-3^2", want: "3 2 ^ neg"},
		{name: "parenthesized negation before power", input: "(-3)^2", want: "3 neg 2 ^"},
		{name: "unary minus after operator", input: "2*-3", want: "2 3 neg *"},
		{name: "binary then unary minus", input: "2--3", want: "2 3 neg -"},
		{name: "unary minus as power exponent", input: "2^-3", want: "2 3 neg ^"},
		{name: "postfix percent binds tightest", input: "50%+10", want: "50 % 10 +"},
		{name: "percent of power exponent", input: "2^50%", want: "2 50 % ^"},
		{name: "percent chains", input: "50%%", want: "50 % %"},
		{name: "function call", input: "sqrt(16)", want: "16 sqrt"},
		{name: "nested function calls", input: "sqrt(sqrt(16))", want: "16 sqrt sqrt"},
		{name: "function inside expression", input: "2*sqrt(9)+1", want: "2 9 sqrt * 1 +"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := rpnString(t, tc.input)
			if err != nil {
				t.Fatalf("toRPN(%q) unexpected error: %v", tc.input, err)
			}
			if got != tc.want {
				t.Fatalf("toRPN(%q) = %q, want %q", tc.input, got, tc.want)
			}
		})
	}
}

func TestToRPNErrors(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantPos int
	}{
		{name: "empty expression", input: "", wantPos: 0},
		{name: "whitespace only", input: "   ", wantPos: 3},
		{name: "doubled plus", input: "2++3", wantPos: 2},
		{name: "trailing operator", input: "(2+", wantPos: 3},
		{name: "unmatched closing paren", input: "2+3)", wantPos: 3},
		{name: "empty parens", input: "()", wantPos: 1},
		{name: "adjacent numbers", input: "2 3", wantPos: 2},
		{name: "unmatched open paren", input: "(2+3", wantPos: 0},
		{name: "bare function name", input: "sqrt", wantPos: 4},
		{name: "function without parens", input: "sqrt 4", wantPos: 5},
		{name: "function followed by operator", input: "sqrt+2", wantPos: 4},
		{name: "empty function call", input: "sqrt()", wantPos: 5},
		{name: "no implicit multiplication", input: "2(3)", wantPos: 1},
		{name: "leading percent", input: "%5", wantPos: 0},
		{name: "percent after operator", input: "2+%", wantPos: 2},
		{name: "leading star", input: "*2", wantPos: 0},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := rpnString(t, tc.input)
			var synErr *apperror.SyntaxError
			if !errors.As(err, &synErr) {
				t.Fatalf("toRPN(%q) error = %v, want *apperror.SyntaxError", tc.input, err)
			}
			if synErr.Position != tc.wantPos {
				t.Fatalf("toRPN(%q) position = %d, want %d (%s)", tc.input, synErr.Position, tc.wantPos, synErr.Reason)
			}
		})
	}
}
