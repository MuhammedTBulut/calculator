package api

import (
	"errors"
	"fmt"
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
	CodeRequestTooLarge  = "REQUEST_TOO_LARGE"
	CodeUnsupportedMedia = "UNSUPPORTED_MEDIA_TYPE"
	CodeRateLimited      = "RATE_LIMITED"
	CodeMethodNotAllowed = "METHOD_NOT_ALLOWED"
	CodeNotFound         = "NOT_FOUND"
	CodeInternal         = "INTERNAL"
)

// mapDomainError translates a domain error into a status code and envelope
// body. Messages are canonical short strings per code — never err.Error() —
// so internal wrapping context cannot leak (OWASP: error leakage). The one
// deliberate exception is SYNTAX_ERROR, whose message is the parser's Reason:
// those strings are purpose-built client-facing descriptions ("unexpected
// ')'"), derived only from single input characters, never from internal
// wrapping (policy revised at review checkpoint 3). A false third return
// means the error is unrecognized and must become 500 INTERNAL (redacted,
// details logged) in the caller.
func mapDomainError(err error) (int, ErrorBody, bool) {
	var syn *apperror.SyntaxError
	if errors.As(err, &syn) {
		pos := syn.Position
		return http.StatusUnprocessableEntity,
			ErrorBody{Code: CodeSyntaxError, Message: syn.Reason, Position: &pos}, true
	}
	if errors.Is(err, apperror.ErrSyntax) {
		// Defensive: every producer wraps ErrSyntax in a SyntaxError, so this
		// bare-sentinel path should be unreachable; position 0 keeps the
		// contract "SYNTAX_ERROR always carries a position" intact.
		pos := 0
		return http.StatusUnprocessableEntity,
			ErrorBody{Code: CodeSyntaxError, Message: "syntax error", Position: &pos}, true
	}

	var unknownFn *apperror.UnknownFunctionError
	if errors.As(err, &unknownFn) {
		// Same precision as SYNTAX_ERROR: names the exact identifier and
		// carries its position, so the UI can underline it the same way it
		// underlines a syntax fault (Display keys off `position` generically,
		// not off the SYNTAX_ERROR code specifically).
		pos := unknownFn.Position
		return http.StatusUnprocessableEntity,
			ErrorBody{
				Code:     CodeUnknownFunction,
				Message:  fmt.Sprintf("unknown function %q", unknownFn.Name),
				Position: &pos,
			}, true
	}
	if errors.Is(err, apperror.ErrUnknownFunction) {
		// Defensive: every producer wraps ErrUnknownFunction in an
		// UnknownFunctionError, so this bare-sentinel path should be
		// unreachable; kept only so the sentinel still maps to something.
		return http.StatusUnprocessableEntity,
			ErrorBody{Code: CodeUnknownFunction, Message: "unknown function"}, true
	}

	for _, m := range []struct {
		sentinel error
		code     string
		message  string
	}{
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
