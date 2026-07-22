package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"strconv"

	"github.com/MuhammedTBulut/calculator/backend/internal/calculator"
)

// maxBodyBytes bounds request bodies. 1024 bytes comfortably fits any
// legitimate calculator request and starves memory-exhaustion attempts
// (OWASP: input limits). The exact limit is documented in docs/openapi.yaml.
const maxBodyBytes = 1024

// Calculator executes named operations and lists them for discovery. It is
// the consumer-side slice of calculator.Registry this adapter needs
// (interface segregation: handlers name their own dependencies).
type Calculator interface {
	Execute(name string, operands ...float64) (float64, error)
	Operations() []calculator.Info
}

// Evaluator evaluates infix expressions; *parser.Evaluator satisfies it.
type Evaluator interface {
	Evaluate(expression string) (float64, error)
}

// Handler serves the calculator HTTP API.
type Handler struct {
	calc Calculator
	eval Evaluator
	log  *slog.Logger
}

// NewHandler wires the adapter to its two domain dependencies. It guards the
// common wiring mistake — a nil interface value; a typed nil stored in an
// interface is the implementer's contract and surfaces through the recovery
// middleware like any other programming error.
func NewHandler(calc Calculator, eval Evaluator, log *slog.Logger) (*Handler, error) {
	if calc == nil {
		return nil, errors.New("new handler: nil Calculator")
	}
	if eval == nil {
		return nil, errors.New("new handler: nil Evaluator")
	}
	if log == nil {
		return nil, errors.New("new handler: nil logger")
	}
	return &Handler{calc: calc, eval: eval, log: log}, nil
}

// Routes returns the adapter's route table. Middleware is composed around it
// in the composition root, not here.
//
// Transport policy (RFC 9110): a known route with a wrong method gets an
// enveloped 405 carrying the mandatory Allow header; an unknown path gets an
// enveloped 404. The GET patterns also serve HEAD (net/http behavior), so
// Allow lists HEAD explicitly. OPTIONS never reaches the mux — the CORS
// middleware answers it.
func (h *Handler) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/v1/calculate", h.calculate)
	mux.HandleFunc("GET /api/v1/operations", h.operations)
	mux.HandleFunc("GET /health", h.health)
	mux.HandleFunc("/api/v1/calculate", methodNotAllowed("POST"))
	mux.HandleFunc("/api/v1/operations", methodNotAllowed("GET, HEAD"))
	mux.HandleFunc("/health", methodNotAllowed("GET, HEAD"))
	mux.HandleFunc("/", notFound)
	return mux
}

// calculate handles POST /api/v1/calculate: exactly one of {operation,
// operands} or {expression}.
func (h *Handler) calculate(w http.ResponseWriter, r *http.Request) {
	// A present-but-wrong media type is rejected; an absent Content-Type is
	// treated as JSON (documented leniency for hand-written curl requests).
	if ct := r.Header.Get("Content-Type"); ct != "" {
		if mt, _, err := mime.ParseMediaType(ct); err != nil || mt != "application/json" {
			writeError(w, http.StatusUnsupportedMediaType,
				ErrorBody{Code: CodeUnsupportedMedia, Message: "Content-Type must be application/json"})
			return
		}
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	var raw rawCalculateRequest
	if err := dec.Decode(&raw); err != nil {
		writeDecodeError(w, err)
		return
	}
	// Anything but EOF after the first value is trailing data. A second
	// Decode is required: Decoder.More() reports false for a stray closing
	// brace, silently accepting `{...} }`.
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		writeDecodeError(w, err)
		return
	}

	hasOperation := raw.Operation != nil
	hasExpression := raw.Expression != nil
	hasOperands := raw.Operands != nil
	switch {
	case hasOperation == hasExpression:
		writeError(w, http.StatusBadRequest,
			ErrorBody{Code: CodeInvalidRequest, Message: "provide exactly one of operation or expression"})
		return
	case hasExpression && hasOperands:
		writeError(w, http.StatusBadRequest,
			ErrorBody{Code: CodeInvalidRequest, Message: "operands is only valid with operation"})
		return
	case hasOperation && !hasOperands:
		writeError(w, http.StatusBadRequest,
			ErrorBody{Code: CodeInvalidRequest, Message: "operands is required with operation"})
		return
	}

	var (
		result float64
		err    error
	)
	if hasExpression {
		expr, ok := asJSONString(raw.Expression)
		if !ok {
			writeError(w, http.StatusBadRequest,
				ErrorBody{Code: CodeInvalidRequest, Message: "expression must be a string"})
			return
		}
		result, err = h.eval.Evaluate(expr)
	} else {
		name, ok := asJSONString(raw.Operation)
		if !ok {
			writeError(w, http.StatusBadRequest,
				ErrorBody{Code: CodeInvalidRequest, Message: "operation must be a string"})
			return
		}
		operands, status, body := parseOperands(raw.Operands)
		if status != 0 {
			writeError(w, status, body)
			return
		}
		result, err = h.calc.Execute(name, operands...)
	}
	if err != nil {
		if status, body, ok := mapDomainError(err); ok {
			writeError(w, status, body)
			return
		}
		// Unrecognized errors are redacted: details go to the log, the
		// client sees only INTERNAL (OWASP: no error leakage).
		h.log.Error("unhandled error",
			"error", err, "path", r.URL.Path, "request_id", requestIDFrom(r.Context()))
		writeError(w, http.StatusInternalServerError,
			ErrorBody{Code: CodeInternal, Message: "internal error"})
		return
	}
	writeJSON(w, http.StatusOK, CalculateResponse{Result: result})
}

// writeDecodeError classifies a JSON decode failure: an exceeded body limit
// is 413 (the size is part of the documented contract), everything else is a
// malformed request.
func writeDecodeError(w http.ResponseWriter, err error) {
	var tooLarge *http.MaxBytesError
	if errors.As(err, &tooLarge) {
		writeError(w, http.StatusRequestEntityTooLarge,
			ErrorBody{Code: CodeRequestTooLarge, Message: "request body exceeds 1024 bytes"})
		return
	}
	writeError(w, http.StatusBadRequest,
		ErrorBody{Code: CodeInvalidRequest, Message: "malformed JSON request body"})
}

func isJSONNull(raw json.RawMessage) bool {
	return bytes.Equal(bytes.TrimSpace(raw), []byte("null"))
}

// asJSONString strictly decodes a JSON string; null and other types fail.
func asJSONString(raw json.RawMessage) (string, bool) {
	if isJSONNull(raw) {
		return "", false
	}
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return "", false
	}
	return s, true
}

// parseOperands strictly decodes the operands array. Decoding via
// json.Number separates shape problems (not an array of numbers → 400) from
// content problems (a syntactically valid number outside float64's range →
// 422 INVALID_OPERAND). A zero status means success.
func parseOperands(raw json.RawMessage) ([]float64, int, ErrorBody) {
	shapeErr := ErrorBody{Code: CodeInvalidRequest, Message: "operands must be an array of numbers"}
	if isJSONNull(raw) {
		return nil, http.StatusBadRequest, shapeErr
	}
	var nums []json.Number
	if err := json.Unmarshal(raw, &nums); err != nil {
		return nil, http.StatusBadRequest, shapeErr
	}
	out := make([]float64, len(nums))
	for i, n := range nums {
		v, err := strconv.ParseFloat(n.String(), 64)
		if err != nil {
			var numErr *strconv.NumError
			if errors.As(err, &numErr) && errors.Is(numErr.Err, strconv.ErrRange) {
				return nil, http.StatusUnprocessableEntity,
					ErrorBody{Code: CodeInvalidOperand, Message: "operand outside the representable range"}
			}
			return nil, http.StatusBadRequest, shapeErr
		}
		out[i] = v
	}
	return out, 0, ErrorBody{}
}

// operations handles GET /api/v1/operations.
func (h *Handler) operations(w http.ResponseWriter, _ *http.Request) {
	infos := h.calc.Operations()
	dtos := make([]OperationDTO, len(infos))
	for i, info := range infos {
		symbol, ok := symbols[info.Name]
		if !ok {
			symbol = info.Name
		}
		dtos[i] = OperationDTO{Name: info.Name, Arity: info.Arity, Symbol: symbol}
	}
	writeJSON(w, http.StatusOK, dtos)
}

// health handles GET /health.
func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, HealthResponse{Status: "ok"})
}

func methodNotAllowed(allow string) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Allow", allow)
		writeError(w, http.StatusMethodNotAllowed,
			ErrorBody{Code: CodeMethodNotAllowed, Message: "method not allowed"})
	}
}

func notFound(w http.ResponseWriter, _ *http.Request) {
	writeError(w, http.StatusNotFound,
		ErrorBody{Code: CodeNotFound, Message: "resource not found"})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	// Encoding a value we constructed cannot fail; ignoring the error keeps
	// handlers linear (a broken connection surfaces in the server logs).
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, body ErrorBody) {
	writeJSON(w, status, ErrorEnvelope{Error: body})
}
