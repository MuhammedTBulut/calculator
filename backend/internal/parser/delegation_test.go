package parser_test

import (
	"errors"
	"math"
	"slices"
	"testing"

	"github.com/MuhammedTBulut/calculator/backend/internal/parser"
)

// spyRegistry records every Execute call while delegating to the real
// registry for results, so the tests can pin that the evaluator performs no
// arithmetic of its own — not even negation or percent.
type spyRegistry struct {
	real  parser.Registry
	calls []spyCall
	fail  map[string]error
}

type spyCall struct {
	name     string
	operands []float64
}

func (s *spyRegistry) Execute(name string, operands ...float64) (float64, error) {
	s.calls = append(s.calls, spyCall{name: name, operands: slices.Clone(operands)})
	if err := s.fail[name]; err != nil {
		return 0, err
	}
	return s.real.Execute(name, operands...)
}

func TestEvaluateDelegatesEveryArithmeticStep(t *testing.T) {
	spy := &spyRegistry{real: newRegistry(t)}
	eval, err := parser.NewEvaluator(spy)
	if err != nil {
		t.Fatalf("NewEvaluator: %v", err)
	}

	// Exercises a function, prefix negation, postfix percent, and a binary
	// operator in one expression: RPN is 4 sqrt neg 50 % +.
	got, err := eval.Evaluate("-sqrt(4)+50%")
	if err != nil {
		t.Fatalf("Evaluate: %v", err)
	}
	if got != -1.5 {
		t.Fatalf("Evaluate = %g, want -1.5", got)
	}

	want := []spyCall{
		{name: "sqrt", operands: []float64{4}},
		{name: "subtract", operands: []float64{0, 2}}, // negation delegates as subtract(0, x)
		{name: "percent", operands: []float64{50}},
		{name: "add", operands: []float64{-2, 0.5}},
	}
	if len(spy.calls) != len(want) {
		t.Fatalf("registry calls = %+v, want %+v", spy.calls, want)
	}
	for i := range want {
		if spy.calls[i].name != want[i].name || !slices.Equal(spy.calls[i].operands, want[i].operands) {
			t.Fatalf("call %d = %+v, want %+v", i, spy.calls[i], want[i])
		}
	}
}

func TestEvaluatePropagatesRegistryErrorsUnchanged(t *testing.T) {
	boom := errors.New("boom from registry")
	spy := &spyRegistry{real: newRegistry(t), fail: map[string]error{"divide": boom}}
	eval, err := parser.NewEvaluator(spy)
	if err != nil {
		t.Fatalf("NewEvaluator: %v", err)
	}

	if _, err := eval.Evaluate("4/2"); !errors.Is(err, boom) {
		t.Fatalf("Evaluate error = %v, want the registry's own error", err)
	}
}

func TestNewEvaluatorRejectsNilRegistry(t *testing.T) {
	if _, err := parser.NewEvaluator(nil); err == nil {
		t.Fatal("NewEvaluator(nil): expected error, got nil")
	}
}

// TestNegativeZeroNormalizes pins the documented signed-zero contract:
// negation delegates as subtract(0, x), so -0 normalizes to +0.
func TestNegativeZeroNormalizes(t *testing.T) {
	eval := newEvaluator(t)
	got, err := eval.Evaluate("-0")
	if err != nil {
		t.Fatalf("Evaluate(-0): %v", err)
	}
	if got != 0 || math.Signbit(got) {
		t.Fatalf("Evaluate(-0) = %g (signbit %v), want +0", got, math.Signbit(got))
	}
}
