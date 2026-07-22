package calculator

// Multiply is binary multiplication.
type Multiply struct{}

// Name implements Operation.
func (Multiply) Name() string { return "multiply" }

// Arity implements Operation.
func (Multiply) Arity() int { return 2 }

// Apply implements Operation.
func (m Multiply) Apply(operands ...float64) (float64, error) {
	if err := checkOperands(m, operands); err != nil {
		return 0, err
	}
	// NOTE: underflow to zero is not an error — it is the IEEE 754 result and
	// harmless for a calculator, unlike overflow which loses all magnitude.
	return checkResult(m, operands[0]*operands[1])
}
