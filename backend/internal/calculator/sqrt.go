package calculator

import (
	"fmt"
	"math"

	"github.com/MuhammedTBulut/calculator/backend/internal/apperror"
)

// Sqrt is the unary square root.
type Sqrt struct{}

// Name implements Operation.
func (Sqrt) Name() string { return "sqrt" }

// Arity implements Operation.
func (Sqrt) Arity() int { return 1 }

// Apply implements Operation.
func (s Sqrt) Apply(operands ...float64) (float64, error) {
	if err := checkOperands(s, operands); err != nil {
		return 0, err
	}
	if operands[0] < 0 {
		return 0, fmt.Errorf("%s: %g: %w", s.Name(), operands[0], apperror.ErrNegativeSqrt)
	}
	return checkResult(s, math.Sqrt(operands[0]))
}
