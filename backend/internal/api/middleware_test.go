package api_test

import (
	"bytes"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/MuhammedTBulut/calculator/backend/internal/api"
	"github.com/MuhammedTBulut/calculator/backend/internal/calculator"
)

// stubCalc lets middleware tests inject panics and unexpected errors behind
// the same consumer-side interface the real registry satisfies.
type stubCalc struct {
	execute func(name string, operands ...float64) (float64, error)
}

func (s stubCalc) Execute(name string, operands ...float64) (float64, error) {
	return s.execute(name, operands...)
}
func (s stubCalc) Operations() []calculator.Info { return nil }

type stubEval struct{}

func (stubEval) Evaluate(string) (float64, error) { return 0, nil }

func stubStack(t *testing.T, log *slog.Logger, execute func(string, ...float64) (float64, error)) http.Handler {
	t.Helper()
	h, err := api.NewHandler(stubCalc{execute: execute}, stubEval{}, log)
	if err != nil {
		t.Fatalf("NewHandler: %v", err)
	}
	return api.WithLogging(log, api.WithRecovery(log, api.WithCORS(testOrigin, h.Routes())))
}

func TestCORSPreflightAllowedOrigin(t *testing.T) {
	h := newStack(t)
	req := jsonRequest(http.MethodOptions, "/api/v1/calculate", "")
	req.Header.Set("Origin", testOrigin)
	req.Header.Set("Access-Control-Request-Method", http.MethodPost)

	rec := do(t, h, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != testOrigin {
		t.Fatalf("Access-Control-Allow-Origin = %q, want %q", got, testOrigin)
	}
	if allow := rec.Header().Get("Access-Control-Allow-Methods"); !strings.Contains(allow, http.MethodPost) {
		t.Fatalf("Access-Control-Allow-Methods = %q, want POST included", allow)
	}
}

func TestCORSPreflightForeignOriginGetsNoGrant(t *testing.T) {
	h := newStack(t)
	req := jsonRequest(http.MethodOptions, "/api/v1/calculate", "")
	req.Header.Set("Origin", "https://evil.example")
	req.Header.Set("Access-Control-Request-Method", http.MethodPost)

	rec := do(t, h, req)
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want empty for a foreign origin", got)
	}
}

func TestCORSActualRequestCarriesGrant(t *testing.T) {
	h := newStack(t)
	req := jsonRequest(http.MethodPost, "/api/v1/calculate", `{"expression":"1+1"}`)
	req.Header.Set("Origin", testOrigin)

	rec := do(t, h, req)
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != testOrigin {
		t.Fatalf("Access-Control-Allow-Origin = %q, want %q", got, testOrigin)
	}
	if !strings.Contains(rec.Header().Get("Vary"), "Origin") {
		t.Fatalf("Vary = %q, want Origin included", rec.Header().Get("Vary"))
	}
	if got := rec.Header().Get("Access-Control-Expose-Headers"); !strings.Contains(got, "X-Request-ID") {
		t.Fatalf("Access-Control-Expose-Headers = %q, want X-Request-ID exposed to scripts", got)
	}
}

func TestRateLimiterAllowsBurstThenReturns429(t *testing.T) {
	limiter, err := api.NewRateLimiter(api.RateLimitConfig{RequestsPerMinute: 60, Burst: 2})
	if err != nil {
		t.Fatalf("NewRateLimiter: %v", err)
	}
	called := 0
	h := limiter.Middleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		called++
		w.WriteHeader(http.StatusNoContent)
	}))

	for i := 0; i < 2; i++ {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate", nil)
		req.RemoteAddr = "203.0.113.8:54321"
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusNoContent {
			t.Fatalf("burst request %d status = %d, want 204", i+1, rec.Code)
		}
	}

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate", nil)
	req.RemoteAddr = "203.0.113.8:54321"
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("excess request status = %d, want 429", rec.Code)
	}
	if got := rec.Header().Get("Retry-After"); got != "1" {
		t.Fatalf("Retry-After = %q, want 1", got)
	}
	if env := decodeError(t, rec.Body.String()); env.Error.Code != api.CodeRateLimited {
		t.Fatalf("code = %q, want RATE_LIMITED", env.Error.Code)
	}
	if called != 2 {
		t.Fatalf("downstream called %d times, want 2", called)
	}
}

func TestRateLimitResponseMatchesOpenAPIContract(t *testing.T) {
	limiter, err := api.NewRateLimiter(api.RateLimitConfig{RequestsPerMinute: 60, Burst: 1})
	if err != nil {
		t.Fatalf("NewRateLimiter: %v", err)
	}
	h := limiter.Middleware(newStack(t))

	req := jsonRequest(http.MethodPost, "/api/v1/calculate", `{"expression":"1+1"}`)
	if rec := do(t, h, req); rec.Code != http.StatusOK {
		t.Fatalf("initial status = %d, want 200", rec.Code)
	}
	req = jsonRequest(http.MethodPost, "/api/v1/calculate", `{"expression":"1+1"}`)
	rec := do(t, h, req)
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("limited status = %d, want 429", rec.Code)
	}
}

func TestRateLimiterSeparatesClientsAndExemptsHealth(t *testing.T) {
	limiter, err := api.NewRateLimiter(api.RateLimitConfig{RequestsPerMinute: 60, Burst: 1})
	if err != nil {
		t.Fatalf("NewRateLimiter: %v", err)
	}
	h := limiter.Middleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	for _, remote := range []string{"203.0.113.10:1000", "203.0.113.11:1000"} {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate", nil)
		req.RemoteAddr = remote
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusNoContent {
			t.Fatalf("first request from %s status = %d, want 204", remote, rec.Code)
		}
	}

	for i := 0; i < 3; i++ {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/health", nil)
		req.RemoteAddr = "203.0.113.10:1000"
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusNoContent {
			t.Fatalf("health request %d status = %d, want 204", i+1, rec.Code)
		}
	}
}

func TestRateLimiterUsesOverwrittenProxyIPOnlyWhenTrusted(t *testing.T) {
	limiter, err := api.NewRateLimiter(api.RateLimitConfig{
		RequestsPerMinute: 60,
		Burst:             1,
		TrustProxy:        true,
	})
	if err != nil {
		t.Fatalf("NewRateLimiter: %v", err)
	}
	h := limiter.Middleware(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	for _, clientIP := range []string{"198.51.100.10", "198.51.100.11"} {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate", nil)
		req.RemoteAddr = "172.18.0.2:4000"
		req.Header.Set("X-Real-IP", clientIP)
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusNoContent {
			t.Fatalf("first request from forwarded client %s status = %d, want 204", clientIP, rec.Code)
		}
	}
}

func TestNewRateLimiterRejectsInvalidPolicy(t *testing.T) {
	for _, cfg := range []api.RateLimitConfig{
		{RequestsPerMinute: 0, Burst: 1},
		{RequestsPerMinute: 60, Burst: 0},
	} {
		if _, err := api.NewRateLimiter(cfg); err == nil {
			t.Fatalf("invalid policy %+v was accepted", cfg)
		}
	}
}

func TestRequestIDGeneratedAndEchoed(t *testing.T) {
	h := newStack(t)

	rec := do(t, h, jsonRequest(http.MethodGet, "/health", ""))
	if rec.Header().Get("X-Request-ID") == "" {
		t.Fatal("X-Request-ID missing from response")
	}

	req := jsonRequest(http.MethodGet, "/health", "")
	req.Header.Set("X-Request-ID", "trace-me-42")
	rec = do(t, h, req)
	if got := rec.Header().Get("X-Request-ID"); got != "trace-me-42" {
		t.Fatalf("X-Request-ID = %q, want inbound id echoed", got)
	}
}

func TestPanicRecoveryReturnsInternalEnvelope(t *testing.T) {
	var logBuf bytes.Buffer
	log := slog.New(slog.NewJSONHandler(&logBuf, nil))
	h := stubStack(t, log, func(string, ...float64) (float64, error) {
		panic("boom: handler bug")
	})

	rec := do(t, h, jsonRequest(http.MethodPost, "/api/v1/calculate", `{"operation":"add","operands":[1,2]}`))
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	env := decodeError(t, rec.Body.String())
	if env.Error.Code != api.CodeInternal {
		t.Fatalf("code = %q, want INTERNAL", env.Error.Code)
	}
	if strings.Contains(rec.Body.String(), "boom") {
		t.Fatalf("panic detail leaked to client: %s", rec.Body.String())
	}
	if !strings.Contains(logBuf.String(), "panic recovered") {
		t.Fatal("panic was not logged")
	}
	if !strings.Contains(logBuf.String(), `"request_id"`) {
		t.Fatal("panic log is missing the request_id correlation")
	}
}

// After a partial write the recovery middleware must abandon the response —
// appending a 500 envelope to committed bytes would corrupt it — and the log
// must report the status the client actually received, not a phantom 500.
func TestRecoveryAfterPartialWriteAbandonsResponse(t *testing.T) {
	var logBuf bytes.Buffer
	log := slog.New(slog.NewJSONHandler(&logBuf, nil))
	h := api.WithLogging(log, api.WithRecovery(log, http.HandlerFunc(
		func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"partial":`))
			panic("late panic")
		})))

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/health", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want the already-committed 200", rec.Code)
	}
	if got := rec.Body.String(); got != `{"partial":` {
		t.Fatalf("body = %q, want the partial write untouched", got)
	}
	if !strings.Contains(logBuf.String(), "panic recovered") {
		t.Fatal("late panic was not logged")
	}
	if !strings.Contains(logBuf.String(), `"status":200`) {
		t.Fatalf("request log must report the client-visible 200:\n%s", logBuf.String())
	}
}

func TestUnexpectedErrorIsRedacted(t *testing.T) {
	var logBuf bytes.Buffer
	log := slog.New(slog.NewJSONHandler(&logBuf, nil))
	h := stubStack(t, log, func(string, ...float64) (float64, error) {
		return 0, errors.New("secret database credentials leaked")
	})

	rec := do(t, h, jsonRequest(http.MethodPost, "/api/v1/calculate", `{"operation":"add","operands":[1,2]}`))
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	env := decodeError(t, rec.Body.String())
	if env.Error.Code != api.CodeInternal {
		t.Fatalf("code = %q, want INTERNAL", env.Error.Code)
	}
	if strings.Contains(rec.Body.String(), "secret") {
		t.Fatalf("error detail leaked to client: %s", rec.Body.String())
	}
	if !strings.Contains(logBuf.String(), "secret database credentials") {
		t.Fatal("error detail missing from server log")
	}
	if !strings.Contains(logBuf.String(), `"request_id"`) {
		t.Fatal("unhandled-error log is missing the request_id correlation")
	}
}

func TestRequestLoggingLine(t *testing.T) {
	var logBuf bytes.Buffer
	log := slog.New(slog.NewJSONHandler(&logBuf, nil))
	h := stubStack(t, log, func(string, ...float64) (float64, error) { return 3, nil })

	do(t, h, jsonRequest(http.MethodPost, "/api/v1/calculate", `{"operation":"add","operands":[1,2]}`))

	line := logBuf.String()
	for _, want := range []string{`"method":"POST"`, `"path":"/api/v1/calculate"`, `"status":200`, `"request_id"`} {
		if !strings.Contains(line, want) {
			t.Fatalf("log line missing %s:\n%s", want, line)
		}
	}
}
