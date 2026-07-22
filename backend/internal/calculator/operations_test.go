package calculator_test

import (
	"errors"
	"math"
	"testing"

	"github.com/MuhammedTBulut/calculator/backend/internal/apperror"
	"github.com/MuhammedTBulut/calculator/backend/internal/calculator"
)

// newRegistry wires every operation the way the composition root will.
func newRegistry(t *testing.T) calculator.Registry {
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

func TestExecute(t *testing.T) {
	reg := newRegistry(t)

	tests := []struct {
		name     string
		op       string
		operands []float64
		want     float64
		wantErr  error
	}{
		// Happy paths.
		{name: "add", op: "add", operands: []float64{2, 3}, want: 5},
		{name: "add negatives", op: "add", operands: []float64{-2.5, -3.5}, want: -6},
		{name: "subtract", op: "subtract", operands: []float64{10, 4}, want: 6},
		{name: "subtract to zero at max magnitude", op: "subtract", operands: []float64{1e308, 1e308}, want: 0},
		{name: "multiply", op: "multiply", operands: []float64{6, 7}, want: 42},
		{name: "multiply by zero", op: "multiply", operands: []float64{1e308, 0}, want: 0},
		{name: "divide", op: "divide", operands: []float64{10, 2}, want: 5},
		{name: "divide negative", op: "divide", operands: []float64{-9, 3}, want: -3},
		{name: "power", op: "power", operands: []float64{2, 10}, want: 1024},
		{name: "power negative exponent", op: "power", operands: []float64{2, -2}, want: 0.25},
		{name: "power of zero exponent", op: "power", operands: []float64{123.456, 0}, want: 1},
		{name: "sqrt", op: "sqrt", operands: []float64{16}, want: 4},
		{name: "sqrt of zero", op: "sqrt", operands: []float64{0}, want: 0},
		{name: "percent", op: "percent", operands: []float64{50}, want: 0.5},
		{name: "percent negative", op: "percent", operands: []float64{-8}, want: -0.08},

		// Very large / very small magnitudes.
		{name: "add smallest subnormals", op: "add",
			operands: []float64{math.SmallestNonzeroFloat64, math.SmallestNonzeroFloat64},
			want:     math.SmallestNonzeroFloat64 * 2},
		{name: "multiply underflows to zero", op: "multiply",
			operands: []float64{math.SmallestNonzeroFloat64, 0.5}, want: 0},
		{name: "add near max stays finite", op: "add",
			operands: []float64{math.MaxFloat64, -math.MaxFloat64}, want: 0},

		// Domain errors.
		{name: "divide by zero", op: "divide", operands: []float64{1, 0}, wantErr: apperror.ErrDivisionByZero},
		{name: "zero divided by zero", op: "divide", operands: []float64{0, 0}, wantErr: apperror.ErrDivisionByZero},
		{name: "sqrt of negative", op: "sqrt", operands: []float64{-1}, wantErr: apperror.ErrNegativeSqrt},

		// Non-finite operands.
		{name: "NaN operand", op: "add", operands: []float64{math.NaN(), 1}, wantErr: apperror.ErrInvalidOperand},
		{name: "positive infinity operand", op: "multiply", operands: []float64{math.Inf(1), 2}, wantErr: apperror.ErrInvalidOperand},
		{name: "negative infinity operand", op: "subtract", operands: []float64{1, math.Inf(-1)}, wantErr: apperror.ErrInvalidOperand},

		// Overflow to ±Inf.
		{name: "add overflows", op: "add", operands: []float64{math.MaxFloat64, math.MaxFloat64}, wantErr: apperror.ErrOverflow},
		{name: "multiply overflows", op: "multiply", operands: []float64{math.MaxFloat64, 2}, wantErr: apperror.ErrOverflow},
		{name: "divide overflows", op: "divide", operands: []float64{math.MaxFloat64, 0.5}, wantErr: apperror.ErrOverflow},
		{name: "power overflows", op: "power", operands: []float64{1e200, 2}, wantErr: apperror.ErrOverflow},
		{name: "power of zero to negative overflows", op: "power", operands: []float64{0, -1}, wantErr: apperror.ErrOverflow},

		// Results outside the mathematical domain.
		{name: "power of negative base with fractional exponent", op: "power",
			operands: []float64{-8, 0.5}, wantErr: apperror.ErrInvalidOperand},

		// Arity mismatches.
		{name: "add with one operand", op: "add", operands: []float64{1}, wantErr: apperror.ErrArityMismatch},
		{name: "add with three operands", op: "add", operands: []float64{1, 2, 3}, wantErr: apperror.ErrArityMismatch},
		{name: "sqrt with two operands", op: "sqrt", operands: []float64{4, 9}, wantErr: apperror.ErrArityMismatch},
		{name: "percent with no operands", op: "percent", operands: nil, wantErr: apperror.ErrArityMismatch},

		// Unknown operation.
		{name: "unknown operation", op: "modulo", operands: []float64{5, 2}, wantErr: apperror.ErrUnknownOperation},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := reg.Execute(tc.op, tc.operands...)
			if tc.wantErr != nil {
				if !errors.Is(err, tc.wantErr) {
					t.Fatalf("Execute(%q, %v) error = %v, want %v", tc.op, tc.operands, err, tc.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("Execute(%q, %v) unexpected error: %v", tc.op, tc.operands, err)
			}
			if got != tc.want {
				t.Fatalf("Execute(%q, %v) = %g, want %g", tc.op, tc.operands, got, tc.want)
			}
		})
	}
}

func TestNewRegistryRejectsDuplicateNames(t *testing.T) {
	_, err := calculator.NewRegistry(calculator.Add{}, calculator.Add{})
	if err == nil {
		t.Fatal("NewRegistry with duplicate operations: expected error, got nil")
	}
}

func TestEmptyRegistryKnowsNothing(t *testing.T) {
	reg, err := calculator.NewRegistry()
	if err != nil {
		t.Fatalf("NewRegistry(): %v", err)
	}
	if _, err := reg.Execute("add", 1, 2); !errors.Is(err, apperror.ErrUnknownOperation) {
		t.Fatalf("Execute on empty registry: error = %v, want ErrUnknownOperation", err)
	}
}
