package calculator_test

import (
	"errors"
	"math"
	"testing"

	"github.com/MuhammedTBulut/calculator/backend/internal/apperror"
	"github.com/MuhammedTBulut/calculator/backend/internal/calculator"
)

// rogueOp deliberately violates the Operation contract so the tests can prove
// Execute enforces the domain invariants itself (review log, checkpoint 1).
type rogueOp struct {
	name   string
	arity  int
	result float64
}

func (r rogueOp) Name() string { return r.name }
func (r rogueOp) Arity() int   { return r.arity }

// Apply claims success no matter what it was given and what it returns.
func (r rogueOp) Apply(_ ...float64) (float64, error) { return r.result, nil }

func TestNewRegistryRejectsBadRegistrations(t *testing.T) {
	tests := []struct {
		name string
		ops  []calculator.Operation
	}{
		{name: "nil operation", ops: []calculator.Operation{nil}},
		{name: "empty operation name", ops: []calculator.Operation{rogueOp{name: "", arity: 1}}},
		{name: "negative arity", ops: []calculator.Operation{rogueOp{name: "weird", arity: -1}}},
		{name: "custom operation shadowing a built-in", ops: []calculator.Operation{
			calculator.Add{}, rogueOp{name: "add", arity: 1},
		}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := calculator.NewRegistry(tc.ops...); err == nil {
				t.Fatal("NewRegistry: expected error, got nil")
			}
		})
	}
}

func TestExecuteEnforcesInvariantsOnNonConformingOperations(t *testing.T) {
	reg, err := calculator.NewRegistry(
		rogueOp{name: "yields-nan", arity: 1, result: math.NaN()},
		rogueOp{name: "yields-inf", arity: 1, result: math.Inf(1)},
	)
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}

	tests := []struct {
		name     string
		op       string
		operands []float64
		wantErr  error
	}{
		{name: "NaN result with nil error is rejected", op: "yields-nan",
			operands: []float64{1}, wantErr: apperror.ErrInvalidOperand},
		{name: "Inf result with nil error is rejected", op: "yields-inf",
			operands: []float64{1}, wantErr: apperror.ErrOverflow},
		{name: "arity enforced before Apply runs", op: "yields-nan",
			operands: []float64{1, 2}, wantErr: apperror.ErrArityMismatch},
		{name: "non-finite operands rejected before Apply runs", op: "yields-nan",
			operands: []float64{math.Inf(-1)}, wantErr: apperror.ErrInvalidOperand},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := reg.Execute(tc.op, tc.operands...); !errors.Is(err, tc.wantErr) {
				t.Fatalf("Execute(%q, %v) error = %v, want %v", tc.op, tc.operands, err, tc.wantErr)
			}
		})
	}
}

func TestOperationsListsRegisteredOperationsSorted(t *testing.T) {
	reg := newRegistry(t)
	want := []calculator.Info{
		{Name: "add", Arity: 2},
		{Name: "divide", Arity: 2},
		{Name: "multiply", Arity: 2},
		{Name: "percent", Arity: 1},
		{Name: "power", Arity: 2},
		{Name: "sqrt", Arity: 1},
		{Name: "subtract", Arity: 2},
	}
	got := reg.Operations()
	if len(got) != len(want) {
		t.Fatalf("Operations() returned %d entries, want %d: %v", len(got), len(want), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("Operations()[%d] = %+v, want %+v", i, got[i], want[i])
		}
	}

	// Mutating the returned slice must not affect the registry (defensive copy).
	got[0] = calculator.Info{Name: "mutated", Arity: 99}
	if again := reg.Operations(); again[0] != want[0] {
		t.Fatalf("Operations() after external mutation = %+v, want %+v", again[0], want[0])
	}
}
