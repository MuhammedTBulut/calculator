// Package main is the composition root: it loads configuration, builds the
// HTTP server, and owns the process lifecycle (startup and graceful shutdown).
// All wiring of adapters to the domain happens here and nowhere else.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

// config carries every environment-derived setting.
// NOTE: plain env vars instead of a config library — two values do not justify
// a dependency (12-factor config, YAGNI).
type config struct {
	port       string
	corsOrigin string
}

func loadConfig() config {
	return config{
		port: envOr("PORT", "8080"),
		// Default matches the Vite dev server so local dev works with zero setup.
		corsOrigin: envOr("CORS_ORIGIN", "http://localhost:5173"),
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	cfg := loadConfig()

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	srv := &http.Server{
		Addr:    ":" + cfg.port,
		Handler: mux,
		// NOTE: timeouts bound how long a slow or hostile client can hold a
		// connection; values are deliberately tight for a small JSON API.
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	serveErr := make(chan error, 1)
	go func() {
		logger.Info("server starting", "addr", srv.Addr, "cors_origin", cfg.corsOrigin)
		serveErr <- srv.ListenAndServe()
	}()

	select {
	case err := <-serveErr:
		if !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server failed", "error", err)
			os.Exit(1)
		}
	case <-ctx.Done():
		logger.Info("shutdown signal received")
		// Give in-flight requests a bounded window to finish before the
		// process exits; new connections are refused immediately.
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := srv.Shutdown(shutdownCtx); err != nil {
			logger.Error("graceful shutdown failed", "error", err)
			os.Exit(1)
		}
	}
	logger.Info("server stopped")
}
