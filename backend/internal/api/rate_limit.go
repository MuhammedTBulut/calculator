package api

import (
	"errors"
	"math"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// RateLimitConfig defines the per-client token-bucket policy. The sustained
// rate is expressed per minute for operator-friendly environment variables;
// Burst is the maximum number of requests accepted at once.
type RateLimitConfig struct {
	RequestsPerMinute int
	Burst             int
	TrustProxy        bool
}

type clientBucket struct {
	tokens   float64
	updated  time.Time
	lastSeen time.Time
}

// RateLimiter protects the calculation endpoint with independent,
// concurrency-safe token buckets keyed by client IP.
type RateLimiter struct {
	mu            sync.Mutex
	clients       map[string]clientBucket
	tokensPerSec  float64
	burst         float64
	trustProxy    bool
	lastSweep     time.Time
	clientIdleTTL time.Duration
	now           func() time.Time
}

// NewRateLimiter constructs a per-client token-bucket limiter. It rejects
// nonsensical policies at startup instead of silently disabling protection.
func NewRateLimiter(cfg RateLimitConfig) (*RateLimiter, error) {
	if cfg.RequestsPerMinute <= 0 {
		return nil, errors.New("new rate limiter: requests per minute must be positive")
	}
	if cfg.Burst <= 0 {
		return nil, errors.New("new rate limiter: burst must be positive")
	}

	tokensPerSec := float64(cfg.RequestsPerMinute) / 60
	timeToFull := time.Duration(math.Ceil(float64(cfg.Burst)/tokensPerSec)) * time.Second
	idleTTL := 10 * time.Minute
	if candidate := 2 * timeToFull; candidate > idleTTL {
		idleTTL = candidate
	}

	return &RateLimiter{
		clients:       make(map[string]clientBucket),
		tokensPerSec:  tokensPerSec,
		burst:         float64(cfg.Burst),
		trustProxy:    cfg.TrustProxy,
		clientIdleTTL: idleTTL,
		now:           time.Now,
	}, nil
}

// Middleware applies the limiter only to calculations. Discovery and health
// routes remain available so UI startup and infrastructure probes cannot be
// starved by a busy client.
func (l *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/api/v1/calculate" {
			next.ServeHTTP(w, r)
			return
		}

		allowed, retryAfter := l.allow(l.clientIP(r), l.now())
		if !allowed {
			w.Header().Set("Retry-After", retryAfter)
			writeError(w, http.StatusTooManyRequests,
				ErrorBody{Code: CodeRateLimited, Message: "rate limit exceeded"})
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (l *RateLimiter) allow(client string, now time.Time) (bool, string) {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.lastSweep.IsZero() || now.Sub(l.lastSweep) >= l.clientIdleTTL {
		for key, bucket := range l.clients {
			if now.Sub(bucket.lastSeen) >= l.clientIdleTTL {
				delete(l.clients, key)
			}
		}
		l.lastSweep = now
	}

	bucket, ok := l.clients[client]
	if !ok {
		bucket = clientBucket{tokens: l.burst, updated: now}
	} else if elapsed := now.Sub(bucket.updated).Seconds(); elapsed > 0 {
		bucket.tokens = math.Min(l.burst, bucket.tokens+elapsed*l.tokensPerSec)
		bucket.updated = now
	}
	bucket.lastSeen = now

	if bucket.tokens < 1 {
		l.clients[client] = bucket
		seconds := int(math.Ceil((1 - bucket.tokens) / l.tokensPerSec))
		if seconds < 1 {
			seconds = 1
		}
		return false, strconv.Itoa(seconds)
	}

	bucket.tokens--
	l.clients[client] = bucket
	return true, ""
}

func (l *RateLimiter) clientIP(r *http.Request) string {
	if l.trustProxy {
		// X-Real-IP is trusted only when the process is reachable exclusively
		// through a reverse proxy that overwrites it (the supplied nginx does).
		if forwarded := strings.TrimSpace(r.Header.Get("X-Real-IP")); net.ParseIP(forwarded) != nil {
			return forwarded
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && net.ParseIP(host) != nil {
		return host
	}
	return r.RemoteAddr
}
