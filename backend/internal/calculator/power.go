package calculator

import (
	"fmt"
	"math"

	"github.com/MuhammedTBulut/calculator/backend/internal/apperror"
)

// Power is binary exponentiation (base, exponent).
type Power struct{}

// Name implements Operation.
func (Power) Name() string { return "power" }

// Arity implements Operation.
func (Power) Arity() int { return 2 }

// Apply implements Operation.
func (p Power) Apply(operands ...float64) (float64, error) {
	if err := checkOperands(p, operands); err != nil {
		return 0, err
	}
	// A zero base with a negative exponent is a pole — 0^-n is 1/0^n — so the
	// IEEE ±Inf here is division by zero, not magnitude overflow (review log,
	// checkpoint 1). The == comparison also catches -0 per IEEE 754.
	if operands[0] == 0 && operands[1] < 0 {
		return 0, fmt.Errorf("%s: %g^%g: %w",
			p.Name(), operands[0], operands[1], apperror.ErrDivisionByZero)
	}
	// NOTE: math.Pow returns NaN for a negative base with a fractional exponent
	// (surfaced as ErrInvalidOperand) and ±Inf on magnitude overflow (surfaced
	// as ErrOverflow); checkResult handles both.
	return checkResult(p, math.Pow(operands[0], operands[1]))
}
