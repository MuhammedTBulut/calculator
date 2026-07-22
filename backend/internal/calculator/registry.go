package calculator

import (
	"cmp"
	"errors"
	"fmt"
	"slices"

	"github.com/MuhammedTBulut/calculator/backend/internal/apperror"
)

// Info describes a registered operation for discovery (the operations listing
// endpoint). It is deliberately presentation-free: display symbols are adapter
// metadata, not domain data.
type Info struct {
	Name  string
	Arity int
}

// Registry maps operation names to implementations and is the single entry
// point for executing them. It is read-only after construction: the only way
// to add operations is NewRegistry.
type Registry struct {
	ops map[string]Operation
	// infos is captured at construction so discovery metadata cannot diverge
	// from what was validated, even for a misbehaving Operation implementation.
	infos []Info
}

// NewRegistry builds a Registry from the given operations. Registering a new
// operation requires no change to any existing domain file: implement
// Operation in a new file and pass it here from the composition root
// (Open/Closed). Nil operations, empty names, negative arities, and duplicate
// names are wiring bugs and reported as errors.
func NewRegistry(ops ...Operation) (Registry, error) {
	r := Registry{
		ops:   make(map[string]Operation, len(ops)),
		infos: make([]Info, 0, len(ops)),
	}
	for _, op := range ops {
		if op == nil {
			return Registry{}, errors.New("new registry: nil operation")
		}
		// Name and arity are read exactly once, so the map key, the duplicate
		// check, and the stored metadata can never disagree.
		name, arity := op.Name(), op.Arity()
		if name == "" {
			return Registry{}, errors.New("new registry: operation with empty name")
		}
		if arity < 0 {
			return Registry{}, fmt.Errorf("new registry: operation %q has negative arity %d", name, arity)
		}
		if _, exists := r.ops[name]; exists {
			return Registry{}, fmt.Errorf("new registry: duplicate operation %q", name)
		}
		r.ops[name] = op
		r.infos = append(r.infos, Info{Name: name, Arity: arity})
	}
	slices.SortFunc(r.infos, func(a, b Info) int { return cmp.Compare(a.Name, b.Name) })
	return r, nil
}

// Operations returns descriptors for every registered operation, sorted by
// name. The slice is a copy, keeping the registry read-only.
func (r Registry) Operations() []Info {
	return slices.Clone(r.infos)
}

// Execute runs the named operation on the operands. Callers interact only
// with Execute, never with an Operation instance (Law of Demeter). Execute
// enforces the domain invariants itself — arity, finite operands, finite
// result — so a non-conforming Operation implementation cannot bypass them;
// the built-in operations validate defensively too, as they are exported and
// directly callable.
func (r Registry) Execute(name string, operands ...float64) (float64, error) {
	op, ok := r.ops[name]
	if !ok {
		return 0, fmt.Errorf("execute %q: %w", name, apperror.ErrUnknownOperation)
	}
	if err := checkOperands(op, operands); err != nil {
		return 0, err
	}
	result, err := op.Apply(operands...)
	if err != nil {
		return 0, err
	}
	return checkResult(op, result)
}
