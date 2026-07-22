package parser_test

import (
	"errors"
	"fmt"
	"math"
	"testing"

	"github.com/MuhammedTBulut/calculator/backend/internal/apperror"
	"pgregory.net/rapid"
)

// genExpr produces a random expression that is well-formed by construction,
// mirroring the grammar the parser accepts.
func genExpr(rt *rapid.T, depth int) string {
	if depth <= 0 {
		return genNumber(rt)
	}
	switch rapid.IntRange(0, 5).Draw(rt, "shape") {
	case 0:
		return genNumber(rt)
	case 1:
		return "(" + genExpr(rt, depth-1) + ")"
	case 2:
		return "-" + genExpr(rt, depth-1)
	case 3:
		op := rapid.SampledFrom([]string{"+", "-", "*", "/", "^"}).Draw(rt, "op")
		return genExpr(rt, depth-1) + op + genExpr(rt, depth-1)
	case 4:
		return "sqrt(" + genExpr(rt, depth-1) + ")"
	default:
		return genExpr(rt, depth-1) + "%"
	}
}

// genNumber emits plain integer or d.d decimal literals only — the grammar
// has no scientific notation, so %g-style output would be lexically invalid.
func genNumber(rt *rapid.T) string {
	whole := rapid.IntRange(0, 9999).Draw(rt, "whole")
	if rapid.Bool().Draw(rt, "decimal") {
		frac := rapid.IntRange(0, 99).Draw(rt, "frac")
		return fmt.Sprintf("%d.%d", whole, frac)
	}
	return fmt.Sprintf("%d", whole)
}

// TestEvaluateWellFormedNeverPanics: for expressions built from the grammar,
// evaluation must never panic (a panic fails the test) and never report a
// syntax error — only a finite value or a typed domain error.
func TestEvaluateWellFormedNeverPanics(t *testing.T) {
	eval := newEvaluator(t)

	domainErrors := []error{
		apperror.ErrDivisionByZero, apperror.ErrNegativeSqrt,
		apperror.ErrInvalidOperand, apperror.ErrOverflow,
	}

	rapid.Check(t, func(rt *rapid.T) {
		expr := genExpr(rt, rapid.IntRange(0, 4).Draw(rt, "depth"))
		got, err := eval.Evaluate(expr)
		if err == nil {
			if math.IsNaN(got) || math.IsInf(got, 0) {
				t.Fatalf("Evaluate(%q) = %g: non-finite result with nil error", expr, got)
			}
			return
		}
		for _, d := range domainErrors {
			if errors.Is(err, d) {
				return
			}
		}
		t.Fatalf("Evaluate(%q) returned non-domain error for well-formed input: %v", expr, err)
	})
}
