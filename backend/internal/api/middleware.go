package api

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"runtime/debug"
	"time"
)

// requestIDKey is the context key carrying the per-request ID, so error and
// panic log records correlate with the request log line.
type requestIDKey struct{}

func requestIDFrom(ctx context.Context) string {
	id, _ := ctx.Value(requestIDKey{}).(string)
	return id
}

// statusRecorder captures the status code a handler writes. The first write
// wins: net/http ignores subsequent WriteHeader calls, so recording them
// would make the log disagree with what the client actually received.
type statusRecorder struct {
	http.ResponseWriter
	status int
	wrote  bool
}

// WriteHeader implements http.ResponseWriter.
func (r *statusRecorder) WriteHeader(status int) {
	if !r.wrote {
		r.status = status
		r.wrote = true
	}
	r.ResponseWriter.WriteHeader(status)
}

// Write implements io.Writer; an implicit 200 counts as the first write.
func (r *statusRecorder) Write(b []byte) (int, error) {
	if !r.wrote {
		r.status = http.StatusOK
		r.wrote = true
	}
	return r.ResponseWriter.Write(b)
}

// WithLogging logs one structured line per request: method, path, status,
// duration, and request ID. The ID is taken from an inbound X-Request-ID if
// present (so upstream traces stay joined) or generated, echoed in the
// response, and placed in the request context for downstream log records.
func WithLogging(log *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		id := r.Header.Get("X-Request-ID")
		if id == "" {
			id = newRequestID()
		}
		w.Header().Set("X-Request-ID", id)

		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r.WithContext(context.WithValue(r.Context(), requestIDKey{}, id)))

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

// WithRecovery converts a handler panic into a logged 500 INTERNAL envelope.
// The envelope is only possible while the response is unstarted; after a
// partial write the truncated response is abandoned and the panic is logged —
// buffering every response to widen that guarantee is not worth the copy.
func WithRecovery(log *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec := &statusRecorder{ResponseWriter: w}
		defer func() {
			if v := recover(); v != nil {
				log.Error("panic recovered",
					"panic", v,
					"path", r.URL.Path,
					"request_id", requestIDFrom(r.Context()),
					"stack", string(debug.Stack()),
				)
				if !rec.wrote {
					writeError(rec, http.StatusInternalServerError,
						ErrorBody{Code: CodeInternal, Message: "internal error"})
				}
			}
		}()
		next.ServeHTTP(rec, r)
	})
}

// WithCORS allows cross-origin calls from exactly one configured origin.
// Every OPTIONS request is answered here, so preflights never reach the
// routes; requests from other origins get no CORS headers, and browsers
// block them (CORS is a browser contract, not authentication).
func WithCORS(origin string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Vary on Origin even when absent so caches never serve a
		// CORS-decorated response to a different origin.
		w.Header().Add("Vary", "Origin")
		if r.Header.Get("Origin") == origin {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			// Without an explicit expose grant, browser scripts cannot read
			// the echoed request ID.
			w.Header().Set("Access-Control-Expose-Headers", "X-Request-ID")
		}
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Request-ID")
			w.Header().Set("Access-Control-Max-Age", "600")
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
