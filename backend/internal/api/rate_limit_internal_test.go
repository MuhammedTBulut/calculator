package api

import (
	"testing"
	"time"
)

func TestRateLimiterRefillsAtConfiguredRate(t *testing.T) {
	limiter, err := NewRateLimiter(RateLimitConfig{RequestsPerMinute: 60, Burst: 1})
	if err != nil {
		t.Fatalf("NewRateLimiter: %v", err)
	}
	now := time.Unix(1_700_000_000, 0)

	if allowed, _ := limiter.allow("client", now); !allowed {
		t.Fatal("initial token was not available")
	}
	if allowed, retry := limiter.allow("client", now); allowed || retry != "1" {
		t.Fatalf("empty bucket = (allowed %t, retry %q), want (false, 1)", allowed, retry)
	}
	if allowed, _ := limiter.allow("client", now.Add(time.Second)); !allowed {
		t.Fatal("one token was not restored after one second at 60 requests/minute")
	}
}
