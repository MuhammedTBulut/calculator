package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func discardLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func testConfig() config {
	return config{
		port:               "8080",
		corsOrigin:         "http://localhost:5173",
		rateLimitPerMinute: 60,
		rateLimitBurst:     20,
	}
}

func TestLoadConfigDefaultsAndOverrides(t *testing.T) {
	cfg, err := loadConfig()
	if err != nil {
		t.Fatalf("loadConfig defaults: %v", err)
	}
	if cfg.port != "8080" || cfg.corsOrigin != "http://localhost:5173" ||
		cfg.rateLimitPerMinute != 60 || cfg.rateLimitBurst != 20 || cfg.trustProxy {
		t.Fatalf("defaults = %+v, want local server defaults", cfg)
	}

	t.Setenv("PORT", "9999")
	t.Setenv("CORS_ORIGIN", "https://calc.example")
	t.Setenv("RATE_LIMIT_PER_MINUTE", "120")
	t.Setenv("RATE_LIMIT_BURST", "30")
	t.Setenv("TRUST_PROXY", "true")
	cfg, err = loadConfig()
	if err != nil {
		t.Fatalf("loadConfig overrides: %v", err)
	}
	if cfg.port != "9999" || cfg.corsOrigin != "https://calc.example" ||
		cfg.rateLimitPerMinute != 120 || cfg.rateLimitBurst != 30 || !cfg.trustProxy {
		t.Fatalf("overrides = %+v, want the environment values", cfg)
	}

	// An empty variable must fall back, not produce an empty setting.
	t.Setenv("PORT", "")
	cfg, err = loadConfig()
	if err != nil {
		t.Fatalf("loadConfig empty PORT: %v", err)
	}
	if got := cfg.port; got != "8080" {
		t.Fatalf("empty PORT gave %q, want the 8080 fallback", got)
	}
}

func TestLoadConfigRejectsInvalidRateLimit(t *testing.T) {
	for _, tc := range []struct {
		name  string
		key   string
		value string
	}{
		{name: "non numeric rate", key: "RATE_LIMIT_PER_MINUTE", value: "many"},
		{name: "zero burst", key: "RATE_LIMIT_BURST", value: "0"},
		{name: "invalid trust proxy", key: "TRUST_PROXY", value: "sometimes"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv(tc.key, tc.value)
			if _, err := loadConfig(); err == nil {
				t.Fatalf("%s=%q was accepted", tc.key, tc.value)
			}
		})
	}
}

// The composition root is the one place the whole stack is assembled, so this
// exercises it end to end: registry → evaluator → adapter → middleware.
func TestBuildHandlerServesTheWiredStack(t *testing.T) {
	cfg := testConfig()
	handler, err := buildHandler(cfg, discardLogger())
	if err != nil {
		t.Fatalf("buildHandler: %v", err)
	}

	tests := []struct {
		name       string
		method     string
		path       string
		body       string
		wantStatus int
		wantBody   string
	}{
		{name: "health", method: http.MethodGet, path: "/health",
			wantStatus: http.StatusOK, wantBody: `{"status":"ok"}`},
		{name: "expression uses the parser and registry", method: http.MethodPost,
			path: "/api/v1/calculate", body: `{"expression":"(2+3)*sqrt(16)"}`,
			wantStatus: http.StatusOK, wantBody: `{"result":20}`},
		{name: "named operation uses the registry", method: http.MethodPost,
			path: "/api/v1/calculate", body: `{"operation":"divide","operands":[10,2]}`,
			wantStatus: http.StatusOK, wantBody: `{"result":5}`},
		{name: "domain errors surface as 422", method: http.MethodPost,
			path: "/api/v1/calculate", body: `{"operation":"divide","operands":[1,0]}`,
			wantStatus: http.StatusUnprocessableEntity, wantBody: `"DIVISION_BY_ZERO"`},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var body io.Reader
			if tc.body != "" {
				body = strings.NewReader(tc.body)
			}
			req := httptest.NewRequest(tc.method, tc.path, body)
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)

			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d (body %s)", rec.Code, tc.wantStatus, rec.Body)
			}
			if !strings.Contains(rec.Body.String(), tc.wantBody) {
				t.Fatalf("body = %s, want it to contain %s", rec.Body.String(), tc.wantBody)
			}
		})
	}
}

func TestBuildHandlerAppliesMiddleware(t *testing.T) {
	cfg := testConfig()
	cfg.rateLimitBurst = 1
	handler, err := buildHandler(cfg, discardLogger())
	if err != nil {
		t.Fatalf("buildHandler: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Fatalf("CORS middleware not wired: Allow-Origin = %q", got)
	}
	if rec.Header().Get("X-Request-ID") == "" {
		t.Fatal("logging middleware not wired: no X-Request-ID")
	}

	for attempt := 1; attempt <= 2; attempt++ {
		req = httptest.NewRequest(http.MethodPost, "/api/v1/calculate",
			strings.NewReader(`{"expression":"1+1"}`))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "http://localhost:5173")
		rec = httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if attempt == 1 && rec.Code != http.StatusOK {
			t.Fatalf("first calculation status = %d, want 200", rec.Code)
		}
	}
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("rate-limited calculation status = %d, want 429", rec.Code)
	}
	if rec.Header().Get("Retry-After") == "" {
		t.Fatal("rate limiter not wired: no Retry-After")
	}
	if rec.Header().Get("X-Request-ID") == "" {
		t.Fatal("rate-limited response bypassed request logging")
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Fatalf("rate-limited response bypassed CORS: Allow-Origin = %q", got)
	}
}

// The healthcheck flag is what the distroless container invokes, so it must
// agree with the running server rather than merely compile.
func TestHealthcheckProbe(t *testing.T) {
	handler, err := buildHandler(testConfig(), discardLogger())
	if err != nil {
		t.Fatalf("buildHandler: %v", err)
	}
	srv := httptest.NewServer(handler)
	defer srv.Close()

	port := srv.Listener.Addr().(interface{ String() string }).String()
	port = port[strings.LastIndex(port, ":")+1:]

	if code := healthcheck(config{port: port}); code != 0 {
		t.Fatalf("healthcheck against a live server = %d, want 0", code)
	}

	srv.Close()
	if code := healthcheck(config{port: port}); code == 0 {
		t.Fatal("healthcheck against a stopped server = 0, want non-zero")
	}
}

// The rate limiter's own validation is reachable through buildHandler even
// though loadConfig itself would never produce an out-of-range config — a
// test can construct one directly, exercising the wiring error path that a
// hardcoded, always-valid operations list keeps the other three
// constructors (NewRegistry/NewEvaluator/NewHandler) from ever reaching.
func TestBuildHandlerRejectsInvalidRateLimitConfig(t *testing.T) {
	cfg := testConfig()
	cfg.rateLimitBurst = 0
	if _, err := buildHandler(cfg, discardLogger()); err == nil {
		t.Fatal("buildHandler with a zero rate-limit burst: expected an error, got nil")
	}
}

// freeLoopbackAddr reserves an OS-assigned loopback port and immediately
// releases it, so a test can put a real address into *http.Server.Addr
// before run() calls ListenAndServe — run() always binds its own listener
// internally, so a test cannot hand it a pre-made net.Listener directly.
func freeLoopbackAddr(t *testing.T) string {
	t.Helper()
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	addr := l.Addr().String()
	if err := l.Close(); err != nil {
		t.Fatalf("close probe listener: %v", err)
	}
	return addr
}

// waitForServing blocks until addr accepts a TCP connection, so a test
// cannot race ahead of run()'s internal ListenAndServe and produce a false
// pass (e.g. canceling the context before the server ever started).
func waitForServing(t *testing.T, addr string) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		conn, err := net.DialTimeout("tcp", addr, 100*time.Millisecond)
		if err == nil {
			conn.Close()
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("server at %s did not start accepting connections in time", addr)
}

func TestRunStopsGracefullyWhenContextIsCanceled(t *testing.T) {
	addr := freeLoopbackAddr(t)
	srv := &http.Server{Addr: addr, Handler: http.NotFoundHandler()}
	ctx, cancel := context.WithCancel(context.Background())

	runErr := make(chan error, 1)
	go func() { runErr <- run(ctx, srv, discardLogger(), 2*time.Second) }()
	waitForServing(t, addr)

	cancel()
	select {
	case err := <-runErr:
		if err != nil {
			t.Fatalf("run() after graceful cancellation = %v, want nil", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("run() did not return within the shutdown timeout")
	}
}

func TestRunReturnsAListenAndServeError(t *testing.T) {
	// Occupy a port first (and keep it open) so the second server's
	// ListenAndServe fails immediately with an ordinary bind error.
	occupied, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer occupied.Close()

	srv := &http.Server{Addr: occupied.Addr().String(), Handler: http.NotFoundHandler()}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	err = run(ctx, srv, discardLogger(), time.Second)
	if err == nil {
		t.Fatal("run() on an already-bound address: expected an error, got nil")
	}
	if errors.Is(err, http.ErrServerClosed) {
		t.Fatalf("run() leaked http.ErrServerClosed instead of the real bind error: %v", err)
	}
}

func TestRunWrapsAShutdownTimeoutError(t *testing.T) {
	addr := freeLoopbackAddr(t)
	blockUntil := make(chan struct{})

	srv := &http.Server{
		Addr: addr,
		Handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			<-blockUntil // held open past the shutdown deadline below
			w.WriteHeader(http.StatusOK)
		}),
	}
	ctx, cancel := context.WithCancel(context.Background())
	runErr := make(chan error, 1)
	go func() { runErr <- run(ctx, srv, discardLogger(), 10*time.Millisecond) }()
	waitForServing(t, addr)

	// Start a request that will still be in flight when shutdown begins, so
	// srv.Shutdown cannot finish within the (deliberately tiny) timeout.
	client := &http.Client{Timeout: 5 * time.Second}
	reqDone := make(chan struct{})
	go func() {
		defer close(reqDone)
		resp, reqErr := client.Get("http://" + addr)
		if reqErr == nil {
			resp.Body.Close()
		}
	}()
	time.Sleep(50 * time.Millisecond) // let the request actually reach the handler
	cancel()

	select {
	case err := <-runErr:
		if err == nil {
			t.Fatal("run() with a request stuck past the shutdown deadline: expected an error, got nil")
		}
		if !strings.Contains(err.Error(), "graceful shutdown") {
			t.Fatalf("run() error = %v, want it wrapped as a graceful-shutdown failure", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("run() did not return within the test's own timeout")
	}

	// run() has already returned its (expected) error; release the stuck
	// handler now so its goroutine and the pending client request finish
	// quickly instead of idling until the client's own 5s timeout.
	close(blockUntil)
	<-reqDone
}

func TestHealthEndpointShape(t *testing.T) {
	handler, err := buildHandler(testConfig(), discardLogger())
	if err != nil {
		t.Fatalf("buildHandler: %v", err)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/health", nil))

	var body struct {
		Status string `json:"status"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Status != "ok" {
		t.Fatalf("status = %q, want ok", body.Status)
	}
}
