# ADR 001 — Standard library over a web framework

**Status:** Accepted

## Context

The backend serves three JSON endpoints. Go's ecosystem offers routers and
frameworks (chi, gin, echo) that supply routing, middleware chains, and
binding. Go 1.22 added method and wildcard patterns to `http.ServeMux`,
covering the routing this API needs.

## Decision

Use `net/http` and `http.ServeMux` only. Middleware is plain
`func(http.Handler) http.Handler` composed explicitly in
`cmd/server/main.go`. The single third-party runtime dependency is none; test
dependencies are `pgregory.net/rapid` (properties) and
`github.com/getkin/kin-openapi` (contract validation).

## Consequences

- Every request's path through the system is readable in one file
  (`buildHandler`), with no framework conventions to learn.
- `govulncheck` has almost no surface to report on, and upgrades are Go
  releases rather than framework majors.
- The cost is hand-written middleware: request IDs, recovery, CORS, and rate
  limiting are ours to maintain and test (`internal/api/middleware.go`,
  `internal/api/rate_limit.go`). At three endpoints this is a favourable
  trade; a larger surface would invert it.
