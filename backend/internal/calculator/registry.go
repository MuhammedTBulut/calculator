package calculator

import (
	"fmt"

	"github.com/MuhammedTBulut/calculator/backend/internal/apperror"
)

// Registry maps operation names to implementations and is the single entry
// point for executing them. It is read-only after construction: the only way
// to add operations is NewRegistry.
type Registry struct {
	ops map[string]Operation
}

// NewRegistry builds a Registry from the given operations. Registering a new
// operation requires no change to any existing domain file: implement
// Operation in a new file and pass it here from the composition root
// (Open/Closed). Duplicate names are a wiring bug and reported as an error.
func NewRegistry(ops ...Operation) (Registry, error) {
	m := make(map[string]Operation, len(ops))
	for _, op := range ops {
		if _, exists := m[op.Name()]; exists {
			return Registry{}, fmt.Errorf("new registry: duplicate operation %q", op.Name())
		}
		m[op.Name()] = op
	}
	return Registry{ops: m}, nil
}

// Execute runs the named operation on the operands. Callers interact only
// with Execute, never with an Operation instance (Law of Demeter).
func (r Registry) Execute(name string, operands ...float64) (float64, error) {
	op, ok := r.ops[name]
	if !ok {
		return 0, fmt.Errorf("execute %q: %w", name, apperror.ErrUnknownOperation)
	}
	return op.Apply(operands...)
}
