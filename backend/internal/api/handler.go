package api

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/MuhammedTBulut/calculator/backend/internal/calculator"
)

// maxBodyBytes bounds request bodies. 1 KiB comfortably fits any legitimate
// calculator request and starves memory-exhaustion attempts (OWASP: input
// limits).
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

// NewHandler wires the adapter to its two domain dependencies. Nil
// dependencies are wiring bugs and rejected at construction.
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
func (h *Handler) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/v1/calculate", h.calculate)
	mux.HandleFunc("GET /api/v1/operations", h.operations)
	mux.HandleFunc("GET /health", h.health)
	return mux
}

// calculate handles POST /api/v1/calculate: exactly one of {operation,
// operands} or {expression}.
func (h *Handler) calculate(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)

	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	var req CalculateRequest
	if err := dec.Decode(&req); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			// NOTE: classified as a malformed request (400) per the
			// CLAUDE.md status discipline, not 413 — the limit is part of
			// the documented request contract.
			writeError(w, http.StatusBadRequest,
				ErrorBody{Code: CodeInvalidRequest, Message: "request body exceeds 1 KiB"})
			return
		}
		writeError(w, http.StatusBadRequest,
			ErrorBody{Code: CodeInvalidRequest, Message: "malformed JSON request body"})
		return
	}
	if dec.More() {
		writeError(w, http.StatusBadRequest,
			ErrorBody{Code: CodeInvalidRequest, Message: "unexpected data after JSON body"})
		return
	}

	hasOperation := req.Operation != nil
	hasExpression := req.Expression != nil
	switch {
	case hasOperation == hasExpression:
		writeError(w, http.StatusBadRequest,
			ErrorBody{Code: CodeInvalidRequest, Message: "provide exactly one of operation or expression"})
		return
	case hasExpression && req.Operands != nil:
		writeError(w, http.StatusBadRequest,
			ErrorBody{Code: CodeInvalidRequest, Message: "operands is only valid with operation"})
		return
	case hasOperation && req.Operands == nil:
		writeError(w, http.StatusBadRequest,
			ErrorBody{Code: CodeInvalidRequest, Message: "operands is required with operation"})
		return
	}

	var (
		result float64
		err    error
	)
	if hasOperation {
		result, err = h.calc.Execute(*req.Operation, req.Operands...)
	} else {
		result, err = h.eval.Evaluate(*req.Expression)
	}
	if err != nil {
		if status, body, ok := mapDomainError(err); ok {
			writeError(w, status, body)
			return
		}
		// Unrecognized errors are redacted: details go to the log, the
		// client sees only INTERNAL (OWASP: no error leakage).
		h.log.Error("unhandled error", "error", err, "path", r.URL.Path)
		writeError(w, http.StatusInternalServerError,
			ErrorBody{Code: CodeInternal, Message: "internal error"})
		return
	}
	writeJSON(w, http.StatusOK, CalculateResponse{Result: result})
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
