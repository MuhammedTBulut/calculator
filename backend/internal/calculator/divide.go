package calculator

import (
	"fmt"

	"github.com/MuhammedTBulut/calculator/backend/internal/apperror"
)

// Divide is binary division.
type Divide struct{}

// Name implements Operation.
func (Divide) Name() string { return "divide" }

// Arity implements Operation.
func (Divide) Arity() int { return 2 }

// Apply implements Operation.
func (d Divide) Apply(operands ...float64) (float64, error) {
	if err := checkOperands(d, operands); err != nil {
		return 0, err
	}
	// Checked here rather than left to IEEE ±Inf/NaN so the caller gets the
	// specific sentinel instead of a generic non-finite-result error.
	if operands[1] == 0 {
		return 0, fmt.Errorf("%s: %g / %g: %w",
			d.Name(), operands[0], operands[1], apperror.ErrDivisionByZero)
	}
	return checkResult(d, operands[0]/operands[1])
}
