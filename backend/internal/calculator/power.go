package calculator

import "math"

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
	// NOTE: math.Pow returns NaN for a negative base with a fractional exponent
	// (surfaced as ErrInvalidOperand) and ±Inf for magnitude overflow and for
	// power(0, negative) (surfaced as ErrOverflow); checkResult handles both.
	return checkResult(p, math.Pow(operands[0], operands[1]))
}
