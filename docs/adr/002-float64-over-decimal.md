# ADR 002 — `float64` over a decimal type

**Status:** Accepted

## Context

Calculator results must be numerically predictable. `float64` is IEEE 754
binary floating point: `0.1 + 0.2 != 0.3` exactly, and magnitudes beyond
~1.8e308 overflow to infinity [Goldberg 1991; IEEE 754-2019]. A decimal
library (`shopspring/decimal`) would make base-10 fractions exact.

## Decision

Use `float64` throughout the domain, and make its failure modes explicit
rather than silent: `checkOperands` rejects NaN and ±Inf inputs and
`checkResult` converts non-finite results into `ErrOverflow` or
`ErrInvalidOperand` (`internal/calculator/operation.go`), so no calculation
returns `NaN` or `Inf` to a caller.

## Consequences

- Arithmetic is fast and dependency-free; `BenchmarkEvaluate` reports
  ~918 ns/op with 22 allocations for a five-operator expression.
- Base-10 fractions remain inexact: `0.1+0.2` displays as `0.30000000000000004`
  unless formatted. The frontend formats for display while keeping the full
  value in state (`src/lib/numberFormat.ts`).
- **This choice would be wrong for money.** A financial context requires a
  decimal representation and explicit rounding rules; that is a different
  system, not a formatting change.
