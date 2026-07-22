// Package calculator is the domain core: pure arithmetic operations and the
// registry that names them. It depends only on the standard library and
// internal/apperror. It MUST NOT import net/http, encoding/json, or anything
// from internal/api — transport concerns stop at the adapter boundary, and the
// dependency direction is strictly api → parser → calculator.
package calculator

import (
	"fmt"
	"math"

	"github.com/MuhammedTBulut/calculator/backend/internal/apperror"
)

// Operation is a named arithmetic operation with a fixed number of operands.
// Implementations must behave as immutable values: Name and Arity are read at
// registration time and must never change afterwards.
type Operation interface {
	// Name returns the unique identifier the Registry looks the operation up by.
	Name() string
	// Arity returns the exact number of operands Apply requires.
	Arity() int
	// Apply computes the result, returning a typed apperror sentinel when the
	// operands are invalid or the result is not a finite float64.
	Apply(operands ...float64) (float64, error)
}

// checkOperands rejects arity mismatches and non-finite operands before any
// arithmetic runs, so every operation shares a single validation contract.
func checkOperands(op Operation, operands []float64) error {
	if len(operands) != op.Arity() {
		return fmt.Errorf("%s: got %d operands, want %d: %w",
			op.Name(), len(operands), op.Arity(), apperror.ErrArityMismatch)
	}
	for _, v := range operands {
		if math.IsNaN(v) || math.IsInf(v, 0) {
			return fmt.Errorf("%s: operand %v: %w", op.Name(), v, apperror.ErrInvalidOperand)
		}
	}
	return nil
}

// checkResult converts non-finite results into typed errors so callers never
// observe NaN or ±Inf.
func checkResult(op Operation, result float64) (float64, error) {
	if math.IsInf(result, 0) {
		return 0, fmt.Errorf("%s: %w", op.Name(), apperror.ErrOverflow)
	}
	if math.IsNaN(result) {
		// NOTE: with finite operands (enforced by checkOperands) a NaN result
		// means the inputs were outside the operation's mathematical domain,
		// e.g. power(-8, 0.5) — classified as an operand problem, not overflow.
		return 0, fmt.Errorf("%s: %w", op.Name(), apperror.ErrInvalidOperand)
	}
	return result, nil
}
