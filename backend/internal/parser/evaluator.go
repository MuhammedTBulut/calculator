package parser

import (
	"errors"
	"fmt"

	"github.com/MuhammedTBulut/calculator/backend/internal/apperror"
)

// Registry is the consumer-side slice of the calculator registry the
// evaluator needs (Dependency Inversion: the parser depends on this
// interface, never on concrete operations; calculator.Registry satisfies it).
type Registry interface {
	Execute(name string, operands ...float64) (float64, error)
}

// binaryOps maps infix operator symbols to registry operation names.
var binaryOps = map[string]string{
	"+": "add",
	"-": "subtract",
	"*": "multiply",
	"/": "divide",
	"^": "power",
}

// functions maps identifier lexemes to registry operation names. An
// identifier missing here is ErrUnknownFunction — checked against this map,
// not the registry, so lexical names stay decoupled from operation names.
var functions = map[string]string{
	"sqrt": "sqrt",
}

// Evaluator evaluates infix expressions against an injected Registry.
type Evaluator struct {
	reg Registry
}

// NewEvaluator wires an Evaluator to the registry that will perform every
// arithmetic step. A nil registry is a wiring bug and is rejected here, at
// the composition root, rather than surfacing as a panic mid-expression.
func NewEvaluator(reg Registry) (*Evaluator, error) {
	if reg == nil {
		return nil, errors.New("new evaluator: nil registry")
	}
	return &Evaluator{reg: reg}, nil
}

// Evaluate parses and evaluates one infix expression. Errors are always
// typed: a *apperror.SyntaxError (wrapping ErrSyntax, with position),
// ErrUnknownFunction, or a domain error propagated unchanged from the
// registry (so division by zero inside an expression surfaces as
// ErrDivisionByZero, not a generic failure).
func (e *Evaluator) Evaluate(input string) (float64, error) {
	tokens, err := tokenize(input)
	if err != nil {
		return 0, err
	}
	rpn, err := toRPN(tokens, len(input))
	if err != nil {
		return 0, err
	}
	return e.evalRPN(rpn)
}

// evalRPN reduces the RPN sequence over a value stack. toRPN guarantees the
// sequence is well-formed; the underflow checks below defend the "never
// panic, always a typed error" invariant against parser bugs (the fuzz test
// leans on this).
func (e *Evaluator) evalRPN(rpn []token) (float64, error) {
	// Function names resolve before any arithmetic executes, so whether an
	// expression is valid never depends on evaluation order — foo(4)+1/0 and
	// 1/0+foo(4) both report the unknown function (parse, don't validate).
	for _, t := range rpn {
		if t.kind == tokIdent {
			if _, known := functions[t.text]; !known {
				return 0, &apperror.UnknownFunctionError{Name: t.text, Position: t.pos}
			}
		}
	}

	stack := make([]float64, 0, 8)

	pop := func() (float64, bool) {
		if len(stack) == 0 {
			return 0, false
		}
		v := stack[len(stack)-1]
		stack = stack[:len(stack)-1]
		return v, true
	}
	malformed := func(t token) error {
		return &apperror.SyntaxError{Position: t.pos, Reason: fmt.Sprintf("misplaced %q", t.text)}
	}

	for _, t := range rpn {
		switch t.kind {
		case tokNumber:
			stack = append(stack, t.val)
			continue

		case tokOperator:
			var result float64
			var err error
			switch t.text {
			case unaryMinus:
				x, ok := pop()
				if !ok {
					return 0, malformed(t)
				}
				// NOTE: negation delegates as subtract(0, x), keeping "every
				// arithmetic step goes through the registry" literally true
				// without a negate op. Exact for every finite x except +0,
				// where -0 normalizes to +0 — intentional: this calculator
				// treats zero as unsigned (pinned by test).
				result, err = e.reg.Execute("subtract", 0, x)
			case "%":
				x, ok := pop()
				if !ok {
					return 0, malformed(t)
				}
				result, err = e.reg.Execute("percent", x)
			default:
				b, okB := pop()
				a, okA := pop()
				if !okA || !okB {
					return 0, malformed(t)
				}
				result, err = e.reg.Execute(binaryOps[t.text], a, b)
			}
			if err != nil {
				return 0, err
			}
			stack = append(stack, result)

		case tokIdent:
			name, known := functions[t.text]
			if !known {
				// Unreachable after the preflight above; kept as defense in
				// depth for the never-panic invariant.
				return 0, malformed(t)
			}
			x, ok := pop()
			if !ok {
				return 0, malformed(t)
			}
			result, err := e.reg.Execute(name, x)
			if err != nil {
				return 0, err
			}
			stack = append(stack, result)

		default:
			return 0, malformed(t)
		}
	}

	if len(stack) != 1 {
		return 0, &apperror.SyntaxError{Position: 0, Reason: "expression does not reduce to a single value"}
	}
	return stack[0], nil
}
