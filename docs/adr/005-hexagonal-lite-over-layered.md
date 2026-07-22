# ADR 005 — Hexagonal-lite over classic layered n-tier

**Status:** Accepted

## Context

A conventional n-tier layout (`controllers` → `services` → `models`) tends to
produce an anemic middle: a `CalculatorService` that forwards calls to data
holders, where the behaviour is thin and the layer exists for symmetry.
Cockburn's ports-and-adapters instead isolates the application from the
technologies driving it [Cockburn, *Hexagonal Architecture*, 2005].

## Decision

Treat `internal/calculator` and `internal/parser` as the core and
`internal/api` as the only inbound adapter. Behaviour lives with the data it
operates on: each `Operation` validates and computes, `Registry.Execute`
enforces the numeric invariants, and the parser inverts its dependency
through the `parser.Registry` interface it declares itself.

## Consequences

- There is no service layer to keep in sync, and no file whose only job is
  delegation.
- Transport concerns cannot leak inward: JSON tags, status codes, and CORS
  exist solely in `internal/api`, asserted by `TestDomainCarriesNoJSONTags`
  and `TestDomainImportBoundaries`.
- The direction is one-way but not a straight line: `internal/api` names
  domain types (`calculator.Info`) and both domain packages depend on
  `internal/apperror`. The rule is that dependencies point inward, not that
  the graph is a chain.
