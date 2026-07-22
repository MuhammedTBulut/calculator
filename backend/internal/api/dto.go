// Package api is the inbound HTTP adapter and the only place JSON meets the
// domain. Request/response DTOs live here and are converted to domain types at
// the boundary ("parse, don't validate"); domain types never carry JSON tags.
// The dependency direction is strictly api → parser → calculator: nothing in
// this package may be imported by the domain core.
package api

// CalculateRequest is the body of POST /api/v1/calculate. Exactly one of
// Operation (with Operands) or Expression must be present; pointers
// distinguish "absent" from "empty" so the handler can enforce that shape.
type CalculateRequest struct {
	Operation *string   `json:"operation,omitempty"`
	Operands  []float64 `json:"operands,omitempty"`
	Expression *string  `json:"expression,omitempty"`
}

// CalculateResponse is the success body of POST /api/v1/calculate.
type CalculateResponse struct {
	Result float64 `json:"result"`
}

// OperationDTO is one entry of GET /api/v1/operations, for UI discovery.
type OperationDTO struct {
	Name   string `json:"name"`
	Arity  int    `json:"arity"`
	Symbol string `json:"symbol"`
}

// HealthResponse is the body of GET /health.
type HealthResponse struct {
	Status string `json:"status"`
}

// ErrorEnvelope is the uniform error body. The frontend renders messages from
// Code — a stable machine-readable identifier — and never parses Message text.
type ErrorEnvelope struct {
	Error ErrorBody `json:"error"`
}

// ErrorBody carries the machine-readable code, a human-oriented message, and,
// for syntax errors only, the byte position of the offending character.
type ErrorBody struct {
	Code     string `json:"code"`
	Message  string `json:"message"`
	Position *int   `json:"position,omitempty"`
}

// symbols is the adapter-owned presentation metadata for operations — the
// expression-syntax token for each name (decision recorded in
// docs/reviews.md, checkpoint 1: symbols are not domain data). An operation
// missing here falls back to its name.
var symbols = map[string]string{
	"add":      "+",
	"subtract": "-",
	"multiply": "*",
	"divide":   "/",
	"power":    "^",
	"percent":  "%",
	"sqrt":     "sqrt",
}
