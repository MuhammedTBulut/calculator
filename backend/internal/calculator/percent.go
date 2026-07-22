package calculator

// Percent is the unary percent operation: percent(x) = x / 100.
type Percent struct{}

// Name implements Operation.
func (Percent) Name() string { return "percent" }

// Arity implements Operation.
func (Percent) Arity() int { return 1 }

// Apply implements Operation.
func (p Percent) Apply(operands ...float64) (float64, error) {
	if err := checkOperands(p, operands); err != nil {
		return 0, err
	}
	// NOTE: fixed unary contract, percent(x) = x/100. Physical calculators
	// treat % context-sensitively, so no equivalence is claimed; the binary
	// reading ("x percent of y") was rejected as it composes from multiply.
	return checkResult(p, operands[0]/100)
}
