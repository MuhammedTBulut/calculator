package api

import (
	"errors"
	"net/http"

	"github.com/MuhammedTBulut/calculator/backend/internal/apperror"
)

// Stable machine-readable error codes. The frontend keys its messages off
// these; changing one is a breaking API change.
const (
	CodeInvalidRequest   = "INVALID_REQUEST"
	CodeDivisionByZero   = "DIVISION_BY_ZERO"
	CodeNegativeSqrt     = "NEGATIVE_SQRT"
	CodeInvalidOperand   = "INVALID_OPERAND"
	CodeOverflow         = "OVERFLOW"
	CodeArityMismatch    = "ARITY_MISMATCH"
	CodeUnknownOperation = "UNKNOWN_OPERATION"
	CodeSyntaxError      = "SYNTAX_ERROR"
	CodeUnknownFunction  = "UNKNOWN_FUNCTION"
	CodeInternal         = "INTERNAL"
)

// mapDomainError translates a domain error into a status code and envelope
// body. Messages are canonical short strings per code — never err.Error() —
// so internal wrapping context cannot leak to clients (OWASP: error leakage).
// A false second return means the error is not a recognized domain error and
// must be handled as 500 INTERNAL (redacted, details logged) by the caller.
func mapDomainError(err error) (int, ErrorBody, bool) {
	var syn *apperror.SyntaxError
	if errors.As(err, &syn) {
		pos := syn.Position
		return http.StatusUnprocessableEntity,
			ErrorBody{Code: CodeSyntaxError, Message: syn.Reason, Position: &pos}, true
	}

	for _, m := range []struct {
		sentinel error
		code     string
		message  string
	}{
		{apperror.ErrSyntax, CodeSyntaxError, "syntax error"},
		{apperror.ErrUnknownFunction, CodeUnknownFunction, "unknown function"},
		{apperror.ErrDivisionByZero, CodeDivisionByZero, "division by zero"},
		{apperror.ErrNegativeSqrt, CodeNegativeSqrt, "square root of a negative number"},
		{apperror.ErrInvalidOperand, CodeInvalidOperand, "invalid operand"},
		{apperror.ErrOverflow, CodeOverflow, "result overflows the representable range"},
		{apperror.ErrArityMismatch, CodeArityMismatch, "wrong number of operands"},
		{apperror.ErrUnknownOperation, CodeUnknownOperation, "unknown operation"},
	} {
		if errors.Is(err, m.sentinel) {
			return http.StatusUnprocessableEntity, ErrorBody{Code: m.code, Message: m.message}, true
		}
	}
	return 0, ErrorBody{}, false
}
