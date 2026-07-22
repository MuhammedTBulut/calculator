# ADR 004 — One deployable service, not a microservice split

**Status:** Accepted

## Context

The brief could be read as an invitation to split calculation, parsing, and
an API gateway into separate services. Fowler names the costs of that split
— distribution, eventual consistency, and operational complexity — and argues
that new systems should start as a monolith because service boundaries are
hardest to guess at the beginning [Fowler, *MonolithFirst*, 2015; Fowler,
*Microservice Trade-Offs*, 2015].

## Decision

Ship one Go service with internal module boundaries (`internal/calculator`,
`internal/parser`, `internal/api`), plus nginx serving the built frontend and
proxying `/api/`. The seams are enforced in code, not by the network:
`TestDomainImportBoundaries` fails the build if the domain reaches outward.

## Consequences

- No inter-service latency, no partial-failure handling, no distributed
  tracing needed for a request that is a few hundred nanoseconds of work.
- The modules are already split along the lines a future extraction would
  follow: each has its own package, interface, and tests.
- Horizontal scaling is limited in one visible way — rate-limit buckets are
  per-process (`internal/api/rate_limit.go`), so multiple replicas would need
  gateway-level or shared-store enforcement. This is documented, not hidden.
