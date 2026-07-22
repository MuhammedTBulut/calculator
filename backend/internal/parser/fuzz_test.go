package parser_test

import (
	"errors"
	"math"
	"testing"

	"github.com/MuhammedTBulut/calculator/backend/internal/apperror"
)

// FuzzEvaluate asserts the parser's safety invariant: for arbitrary input
// bytes, Evaluate never panics and always returns either a finite result or
// an error classified by the apperror taxonomy. ErrArityMismatch and
// ErrUnknownOperation are deliberately NOT accepted — reaching them from an
// expression would mean the parser mis-wired the registry.
func FuzzEvaluate(f *testing.F) {
	seeds := []string{
		"2+3*4", "(2+3)*4", "2^3^2", "8-3-2",
		"-3^2", "(-3)^2", "2*-3", "2--3", "2^-1",
		"sqrt(16)", "sqrt(sqrt(16))", "2*sqrt(9)+1",
		"50%", "50%+10", "200*50%", "50%%",
		"1.5+2.25", ".5*4", " 2 + 3 ",
		"10/(5-5)", "sqrt(-1)", "10^308*10", "foo(4)",
		"", "   ", "2++3", "(2+", "2+3)", "()", "2 3",
		"1.2.3", "2$3", "sqrt", "sqrt 4", "sqrt+2", "sqrt()",
		"2(3)", "%5", "2+%", "*2", "2×3", "1 +2",
	}
	for _, s := range seeds {
		f.Add(s)
	}

	eval := newEvaluator(f)
	allowed := []error{
		apperror.ErrSyntax, apperror.ErrUnknownFunction,
		apperror.ErrDivisionByZero, apperror.ErrNegativeSqrt,
		apperror.ErrInvalidOperand, apperror.ErrOverflow,
	}

	f.Fuzz(func(t *testing.T, input string) {
		got, err := eval.Evaluate(input)
		if err == nil {
			if math.IsNaN(got) || math.IsInf(got, 0) {
				t.Errorf("Evaluate(%q) = %g: non-finite result with nil error", input, got)
			}
			return
		}
		for _, a := range allowed {
			if errors.Is(err, a) {
				return
			}
		}
		t.Errorf("Evaluate(%q) returned an error outside the apperror taxonomy: %v", input, err)
	})
}
