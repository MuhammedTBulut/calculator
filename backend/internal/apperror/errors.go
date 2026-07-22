// Package apperror defines the typed sentinel errors shared across layers.
// Domain packages return them wrapped with %w and context; the HTTP adapter
// maps them to status codes at the boundary. The package imports only the
// standard library, so any layer may depend on it without bending the
// dependency direction (api → parser → calculator).
package apperror

import (
	"errors"
	"fmt"
)

// Sentinel errors for the calculator domain. Callers match with errors.Is;
// they never compare messages.
var (
	// ErrDivisionByZero reports a division whose divisor is zero.
	ErrDivisionByZero = errors.New("division by zero")

	// ErrNegativeSqrt reports a square root of a negative operand.
	ErrNegativeSqrt = errors.New("square root of a negative number")

	// ErrInvalidOperand reports operands outside an operation's domain,
	// including NaN and ±Inf inputs (rejected per IEEE 754 semantics rather
	// than silently propagated).
	ErrInvalidOperand = errors.New("invalid operand")

	// ErrOverflow reports a result that overflows float64 to ±Inf.
	ErrOverflow = errors.New("result overflows float64")

	// ErrArityMismatch reports a call with the wrong number of operands.
	ErrArityMismatch = errors.New("wrong number of operands")

	// ErrUnknownOperation reports a lookup of an unregistered operation name.
	ErrUnknownOperation = errors.New("unknown operation")

	// ErrSyntax reports a malformed expression. Errors carrying a position
	// wrap it via SyntaxError; match the class with errors.Is(err, ErrSyntax)
	// and extract the position with errors.As.
	ErrSyntax = errors.New("syntax error")

	// ErrUnknownFunction reports a call to a function name the evaluator does
	// not recognize.
	ErrUnknownFunction = errors.New("unknown function")
)

// SyntaxError couples ErrSyntax with the byte offset where the input became
// invalid, so the adapter can point at the failing character. Position is
// 0-based; for an unexpected end of input it equals len(input).
type SyntaxError struct {
	Position int
	Reason   string
}

// Error implements the error interface.
func (e *SyntaxError) Error() string {
	return fmt.Sprintf("syntax error at position %d: %s", e.Position, e.Reason)
}

// Unwrap makes errors.Is(err, ErrSyntax) hold for every SyntaxError.
func (e *SyntaxError) Unwrap() error { return ErrSyntax }
