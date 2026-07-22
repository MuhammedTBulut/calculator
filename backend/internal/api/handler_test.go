package api_test

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/MuhammedTBulut/calculator/backend/internal/api"
	"github.com/MuhammedTBulut/calculator/backend/internal/calculator"
	"github.com/MuhammedTBulut/calculator/backend/internal/parser"
)

const testOrigin = "http://localhost:5173"

func discardLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

// newStack builds the full production middleware chain around the real
// domain, exactly as the composition root wires it.
func newStack(t testing.TB) http.Handler {
	t.Helper()
	reg, err := calculator.NewRegistry(
		calculator.Add{}, calculator.Subtract{}, calculator.Multiply{},
		calculator.Divide{}, calculator.Power{}, calculator.Sqrt{},
		calculator.Percent{},
	)
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	eval, err := parser.NewEvaluator(reg)
	if err != nil {
		t.Fatalf("NewEvaluator: %v", err)
	}
	log := discardLogger()
	h, err := api.NewHandler(reg, eval, log)
	if err != nil {
		t.Fatalf("NewHandler: %v", err)
	}
	return api.WithLogging(log, api.WithRecovery(log, api.WithCORS(testOrigin, h.Routes())))
}

func decodeError(t *testing.T, body string) api.ErrorEnvelope {
	t.Helper()
	var env api.ErrorEnvelope
	if err := json.Unmarshal([]byte(body), &env); err != nil {
		t.Fatalf("error body is not an envelope: %v\nbody: %s", err, body)
	}
	return env
}

func intPtr(i int) *int { return &i }

func TestCalculate(t *testing.T) {
	h := newStack(t)

	tests := []struct {
		name       string
		body       string
		wantStatus int
		wantResult float64 // checked when wantCode is empty
		wantCode   string
		wantPos    *int
	}{
		// Success paths.
		{name: "named operation", body: `{"operation":"divide","operands":[10,2]}`,
			wantStatus: http.StatusOK, wantResult: 5},
		{name: "unary operation", body: `{"operation":"sqrt","operands":[16]}`,
			wantStatus: http.StatusOK, wantResult: 4},
		{name: "expression", body: `{"expression":"2+3*4"}`,
			wantStatus: http.StatusOK, wantResult: 14},
		{name: "expression with unary minus and percent", body: `{"expression":"-sqrt(4)+50%"}`,
			wantStatus: http.StatusOK, wantResult: -1.5},

		// 400: malformed request shapes.
		{name: "both forms", body: `{"operation":"add","operands":[1,2],"expression":"1"}`,
			wantStatus: http.StatusBadRequest, wantCode: api.CodeInvalidRequest},
		{name: "neither form", body: `{}`,
			wantStatus: http.StatusBadRequest, wantCode: api.CodeInvalidRequest},
		{name: "expression with operands", body: `{"expression":"1+1","operands":[1]}`,
			wantStatus: http.StatusBadRequest, wantCode: api.CodeInvalidRequest},
		{name: "operation without operands", body: `{"operation":"add"}`,
			wantStatus: http.StatusBadRequest, wantCode: api.CodeInvalidRequest},
		{name: "malformed JSON", body: `{`,
			wantStatus: http.StatusBadRequest, wantCode: api.CodeInvalidRequest},
		{name: "unknown field", body: `{"expression":"1","bogus":true}`,
			wantStatus: http.StatusBadRequest, wantCode: api.CodeInvalidRequest},
		{name: "trailing data", body: `{"expression":"1"} {"again":true}`,
			wantStatus: http.StatusBadRequest, wantCode: api.CodeInvalidRequest},
		{name: "stray closing brace", body: `{"expression":"1"} }`,
			wantStatus: http.StatusBadRequest, wantCode: api.CodeInvalidRequest},

		// Explicit null is presence with an invalid value, not absence.
		{name: "null operation with expression", body: `{"expression":"1+1","operation":null}`,
			wantStatus: http.StatusBadRequest, wantCode: api.CodeInvalidRequest},
		{name: "null operands with expression", body: `{"expression":"1+1","operands":null}`,
			wantStatus: http.StatusBadRequest, wantCode: api.CodeInvalidRequest},
		{name: "null expression with operation", body: `{"operation":"add","operands":[],"expression":null}`,
			wantStatus: http.StatusBadRequest, wantCode: api.CodeInvalidRequest},
		{name: "operation not a string", body: `{"operation":5,"operands":[1]}`,
			wantStatus: http.StatusBadRequest, wantCode: api.CodeInvalidRequest},
		{name: "operands not an array", body: `{"operation":"add","operands":"nope"}`,
			wantStatus: http.StatusBadRequest, wantCode: api.CodeInvalidRequest},

		// 413: the body limit is part of the documented contract (RFC 9110).
		{name: "oversized body", body: `{"expression":"` + strings.Repeat("1+", 600) + `1"}`,
			wantStatus: http.StatusRequestEntityTooLarge, wantCode: api.CodeRequestTooLarge},
		{name: "oversized via trailing whitespace", body: `{"expression":"1"}` + strings.Repeat(" ", 1200),
			wantStatus: http.StatusRequestEntityTooLarge, wantCode: api.CodeRequestTooLarge},

		// A valid JSON number beyond float64 is content, not shape.
		{name: "operand beyond float64 range", body: `{"operation":"add","operands":[1e309,1]}`,
			wantStatus: http.StatusUnprocessableEntity, wantCode: api.CodeInvalidOperand},

		// 422: valid shape, domain rejection.
		{name: "unknown operation", body: `{"operation":"modulo","operands":[5,2]}`,
			wantStatus: http.StatusUnprocessableEntity, wantCode: api.CodeUnknownOperation},
		{name: "arity mismatch", body: `{"operation":"divide","operands":[1]}`,
			wantStatus: http.StatusUnprocessableEntity, wantCode: api.CodeArityMismatch},
		{name: "division by zero via operation", body: `{"operation":"divide","operands":[1,0]}`,
			wantStatus: http.StatusUnprocessableEntity, wantCode: api.CodeDivisionByZero},
		{name: "division by zero via expression", body: `{"expression":"10/(5-5)"}`,
			wantStatus: http.StatusUnprocessableEntity, wantCode: api.CodeDivisionByZero},
		{name: "negative sqrt", body: `{"operation":"sqrt","operands":[-1]}`,
			wantStatus: http.StatusUnprocessableEntity, wantCode: api.CodeNegativeSqrt},
		{name: "overflow", body: `{"operation":"multiply","operands":[1.7976931348623157e308,2]}`,
			wantStatus: http.StatusUnprocessableEntity, wantCode: api.CodeOverflow},
		{name: "invalid operand via expression", body: `{"expression":"(0-8)^0.5"}`,
			wantStatus: http.StatusUnprocessableEntity, wantCode: api.CodeInvalidOperand},
		// Unknown function names carry the same byte-position precision as a
		// syntax error, pointing at the identifier rather than the call site.
		{name: "unknown function at the start of the expression", body: `{"expression":"foo(4)"}`,
			wantStatus: http.StatusUnprocessableEntity, wantCode: api.CodeUnknownFunction, wantPos: intPtr(0)},
		{name: "unknown function mid-expression", body: `{"expression":"1+bar(2)"}`,
			wantStatus: http.StatusUnprocessableEntity, wantCode: api.CodeUnknownFunction, wantPos: intPtr(2)},

		// Syntax errors carry the byte position for the UI underline.
		{name: "syntax error with position", body: `{"expression":"2++3"}`,
			wantStatus: http.StatusUnprocessableEntity, wantCode: api.CodeSyntaxError, wantPos: intPtr(2)},
		{name: "syntax error at end of input", body: `{"expression":"(2+"}`,
			wantStatus: http.StatusUnprocessableEntity, wantCode: api.CodeSyntaxError, wantPos: intPtr(3)},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rec := do(t, h, jsonRequest(http.MethodPost, "/api/v1/calculate", tc.body))
			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d\nbody: %s", rec.Code, tc.wantStatus, rec.Body.String())
			}
			if tc.wantCode == "" {
				var resp api.CalculateResponse
				if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
					t.Fatalf("decode success body: %v", err)
				}
				if resp.Result != tc.wantResult {
					t.Fatalf("result = %g, want %g", resp.Result, tc.wantResult)
				}
				return
			}
			env := decodeError(t, rec.Body.String())
			if env.Error.Code != tc.wantCode {
				t.Fatalf("code = %q, want %q (message: %s)", env.Error.Code, tc.wantCode, env.Error.Message)
			}
			if tc.wantPos != nil {
				if env.Error.Position == nil {
					t.Fatalf("position missing, want %d", *tc.wantPos)
				}
				if *env.Error.Position != *tc.wantPos {
					t.Fatalf("position = %d, want %d", *env.Error.Position, *tc.wantPos)
				}
			} else if env.Error.Position != nil {
				t.Fatalf("position = %d, want absent (only syntax errors carry it)", *env.Error.Position)
			}
		})
	}
}

// The message must name the exact identifier, not a generic "unknown
// function" — the precision this stage added alongside the position.
func TestUnknownFunctionMessageNamesTheIdentifier(t *testing.T) {
	h := newStack(t)
	rec := do(t, h, jsonRequest(http.MethodPost, "/api/v1/calculate", `{"expression":"1+bogus(2)"}`))

	env := decodeError(t, rec.Body.String())
	if env.Error.Code != api.CodeUnknownFunction {
		t.Fatalf("code = %q, want UNKNOWN_FUNCTION", env.Error.Code)
	}
	if !strings.Contains(env.Error.Message, `"bogus"`) {
		t.Fatalf("message = %q, want it to name the identifier", env.Error.Message)
	}
}

func TestOperationsEndpoint(t *testing.T) {
	h := newStack(t)
	rec := do(t, h, jsonRequest(http.MethodGet, "/api/v1/operations", ""))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var ops []api.OperationDTO
	if err := json.Unmarshal(rec.Body.Bytes(), &ops); err != nil {
		t.Fatalf("decode: %v", err)
	}
	want := []api.OperationDTO{
		{Name: "add", Arity: 2, Symbol: "+"},
		{Name: "divide", Arity: 2, Symbol: "/"},
		{Name: "multiply", Arity: 2, Symbol: "*"},
		{Name: "percent", Arity: 1, Symbol: "%"},
		{Name: "power", Arity: 2, Symbol: "^"},
		{Name: "sqrt", Arity: 1, Symbol: "sqrt"},
		{Name: "subtract", Arity: 2, Symbol: "-"},
	}
	if len(ops) != len(want) {
		t.Fatalf("operations = %+v, want %+v", ops, want)
	}
	for i := range want {
		if ops[i] != want[i] {
			t.Fatalf("operations[%d] = %+v, want %+v", i, ops[i], want[i])
		}
	}
}

func TestHealthEndpoint(t *testing.T) {
	h := newStack(t)
	rec := do(t, h, jsonRequest(http.MethodGet, "/health", ""))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if got := strings.TrimSpace(rec.Body.String()); got != `{"status":"ok"}` {
		t.Fatalf("body = %s, want {\"status\":\"ok\"}", got)
	}
}

func TestContentTypeEnforcement(t *testing.T) {
	h := newStack(t)

	req := jsonRequest(http.MethodPost, "/api/v1/calculate", `{"expression":"1+1"}`)
	req.Header.Set("Content-Type", "text/plain")
	rec := do(t, h, req)
	if rec.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("status = %d, want 415", rec.Code)
	}
	if env := decodeError(t, rec.Body.String()); env.Error.Code != api.CodeUnsupportedMedia {
		t.Fatalf("code = %q, want UNSUPPORTED_MEDIA_TYPE", env.Error.Code)
	}

	// Absent Content-Type is documented leniency: treated as JSON.
	req = jsonRequest(http.MethodPost, "/api/v1/calculate", `{"expression":"1+1"}`)
	req.Header.Del("Content-Type")
	if rec := do(t, h, req); rec.Code != http.StatusOK {
		t.Fatalf("status without Content-Type = %d, want 200", rec.Code)
	}
}

// 405/404 have no per-operation home in OpenAPI 3.0, so they are asserted
// directly; the policy is documented globally in the spec's info section.
func TestMethodNotAllowedEnvelope(t *testing.T) {
	h := newStack(t)

	tests := []struct {
		method    string
		path      string
		wantAllow string
	}{
		{method: http.MethodGet, path: "/api/v1/calculate", wantAllow: "POST"},
		{method: http.MethodDelete, path: "/api/v1/operations", wantAllow: "GET, HEAD"},
		{method: http.MethodPost, path: "/health", wantAllow: "GET, HEAD"},
	}
	for _, tc := range tests {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, httptest.NewRequest(tc.method, tc.path, nil))
			if rec.Code != http.StatusMethodNotAllowed {
				t.Fatalf("status = %d, want 405", rec.Code)
			}
			if got := rec.Header().Get("Allow"); got != tc.wantAllow {
				t.Fatalf("Allow = %q, want %q (RFC 9110 requires it on 405)", got, tc.wantAllow)
			}
			if env := decodeError(t, rec.Body.String()); env.Error.Code != api.CodeMethodNotAllowed {
				t.Fatalf("code = %q, want METHOD_NOT_ALLOWED", env.Error.Code)
			}
		})
	}
}

func TestNotFoundEnvelope(t *testing.T) {
	h := newStack(t)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/nope", nil))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
	if env := decodeError(t, rec.Body.String()); env.Error.Code != api.CodeNotFound {
		t.Fatalf("code = %q, want NOT_FOUND", env.Error.Code)
	}
}

func TestNewHandlerRejectsNilDependencies(t *testing.T) {
	reg, err := calculator.NewRegistry(calculator.Add{})
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	eval, err := parser.NewEvaluator(reg)
	if err != nil {
		t.Fatalf("NewEvaluator: %v", err)
	}
	log := discardLogger()

	if _, err := api.NewHandler(nil, eval, log); err == nil {
		t.Fatal("nil Calculator accepted")
	}
	if _, err := api.NewHandler(reg, nil, log); err == nil {
		t.Fatal("nil Evaluator accepted")
	}
	if _, err := api.NewHandler(reg, eval, nil); err == nil {
		t.Fatal("nil logger accepted")
	}
}
