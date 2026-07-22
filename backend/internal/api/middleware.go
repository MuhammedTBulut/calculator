package api

import (
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"runtime/debug"
	"time"
)

// statusRecorder captures the status code a handler writes so the logging
// middleware can report it.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

// WriteHeader implements http.ResponseWriter.
func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

// WithLogging logs one structured line per request: method, path, status,
// duration, and request ID. The ID is taken from an inbound X-Request-ID if
// present (so upstream traces stay joined) or generated, and always echoed
// back in the response.
func WithLogging(log *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		id := r.Header.Get("X-Request-ID")
		if id == "" {
			id = newRequestID()
		}
		w.Header().Set("X-Request-ID", id)

		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)

		log.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", rec.status,
			"duration_ms", time.Since(start).Milliseconds(),
			"request_id", id,
		)
	})
}

func newRequestID() string {
	var b [8]byte
	// rand.Read on crypto/rand never fails on supported platforms (Go 1.24+
	// panics internally instead of returning an error).
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}

// WithRecovery converts a handler panic into a logged 500 INTERNAL envelope,
// so a bug can never take the process down or leak a stack trace to clients.
func WithRecovery(log *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				log.Error("panic recovered",
					"panic", v,
					"path", r.URL.Path,
					"stack", string(debug.Stack()),
				)
				writeError(w, http.StatusInternalServerError,
					ErrorBody{Code: CodeInternal, Message: "internal error"})
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// WithCORS allows cross-origin calls from exactly one configured origin.
// Preflights are answered here; requests from other origins get no CORS
// headers, so browsers block them (the API itself stays reachable — CORS is
// a browser contract, not authentication).
func WithCORS(origin string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Vary on Origin even when absent so caches never serve a
		// CORS-decorated response to a different origin.
		w.Header().Add("Vary", "Origin")
		if r.Header.Get("Origin") == origin {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		}
		if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Request-ID")
			w.Header().Set("Access-Control-Max-Age", "600")
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
