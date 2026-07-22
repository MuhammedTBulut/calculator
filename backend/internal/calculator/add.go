package calculator

// Add is binary addition.
type Add struct{}

// Name implements Operation.
func (Add) Name() string { return "add" }

// Arity implements Operation.
func (Add) Arity() int { return 2 }

// Apply implements Operation.
func (a Add) Apply(operands ...float64) (float64, error) {
	if err := checkOperands(a, operands); err != nil {
		return 0, err
	}
	return checkResult(a, operands[0]+operands[1])
}
