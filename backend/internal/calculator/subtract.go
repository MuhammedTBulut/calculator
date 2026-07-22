package calculator

// Subtract is binary subtraction.
type Subtract struct{}

// Name implements Operation.
func (Subtract) Name() string { return "subtract" }

// Arity implements Operation.
func (Subtract) Arity() int { return 2 }

// Apply implements Operation.
func (s Subtract) Apply(operands ...float64) (float64, error) {
	if err := checkOperands(s, operands); err != nil {
		return 0, err
	}
	return checkResult(s, operands[0]-operands[1])
}
