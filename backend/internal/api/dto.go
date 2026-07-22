// Package api is the inbound HTTP adapter and the only place JSON meets the
// domain. Request/response DTOs live here and are converted to domain types at
// the boundary ("parse, don't validate"); domain types never carry JSON tags.
// The dependency direction is strictly api → parser → calculator: nothing in
// this package may be imported by the domain core.
package api

import "encoding/json"

// rawCalculateRequest is the wire shape of POST /api/v1/calculate before
// validation. json.RawMessage fields make presence observable — a field is
// present iff its RawMessage is non-nil — which pointer fields cannot do
// (both absent and explicit null decode to a nil pointer). The handler then
// converts each present field strictly, rejecting null and wrong types
// ("parse, don't validate" applied to the wire format itself).
type rawCalculateRequest struct {
	Operation  json.RawMessage `json:"operation"`
	Operands   json.RawMessage `json:"operands"`
	Expression json.RawMessage `json:"expression"`
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
