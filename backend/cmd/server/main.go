// Package main is the composition root: it loads configuration, wires the
// domain registry, parser, and HTTP adapter together by hand (manual
// constructor injection), and owns the process lifecycle. All wiring happens
// here and nowhere else.
package main

import (
	"context"
	"errors"
	"flag"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/MuhammedTBulut/calculator/backend/internal/api"
	"github.com/MuhammedTBulut/calculator/backend/internal/calculator"
	"github.com/MuhammedTBulut/calculator/backend/internal/parser"
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

// buildHandler assembles registry → evaluator → HTTP adapter → middleware.
// Registering a new operation means adding it to this one list — no existing
// domain file changes (Open/Closed).
func buildHandler(cfg config, logger *slog.Logger) (http.Handler, error) {
	registry, err := calculator.NewRegistry(
		calculator.Add{}, calculator.Subtract{}, calculator.Multiply{},
		calculator.Divide{}, calculator.Power{}, calculator.Sqrt{},
		calculator.Percent{},
	)
	if err != nil {
		return nil, err
	}
	evaluator, err := parser.NewEvaluator(registry)
	if err != nil {
		return nil, err
	}
	handler, err := api.NewHandler(registry, evaluator, logger)
	if err != nil {
		return nil, err
	}
	// Logging wraps recovery so panics are logged with their final 500
	// status; CORS sits innermost, decorating only real route traffic.
	return api.WithLogging(logger,
		api.WithRecovery(logger,
			api.WithCORS(cfg.corsOrigin, handler.Routes()))), nil
}

// healthcheck probes a running instance and exits non-zero if it is not
// serving. It exists because the distroless runtime image ships no shell and
// no curl, so the binary has to be its own container healthcheck.
func healthcheck(cfg config) int {
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get("http://127.0.0.1:" + cfg.port + "/health")
	if err != nil {
		return 1
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 1
	}
	return 0
}

func main() {
	probe := flag.Bool("healthcheck", false, "probe a running server and exit")
	flag.Parse()

	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	cfg := loadConfig()

	if *probe {
		os.Exit(healthcheck(cfg))
	}

	handler, err := buildHandler(cfg, logger)
	if err != nil {
		logger.Error("wiring failed", "error", err)
		os.Exit(1)
	}

	srv := &http.Server{
		Addr:    ":" + cfg.port,
		Handler: handler,
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
