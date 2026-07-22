# ADR 003 — An expression parser alongside the single-operation endpoint

**Status:** Accepted

## Context

`POST /api/v1/calculate` could accept only `{"operation", "operands"}`, which
is trivial to implement and validate. But a calculator UI accumulates
`2+3*4` as a whole, and pushing precedence into the client would put domain
logic in the browser — where it cannot be fuzzed, property-tested, or reused
by another client.

## Decision

Accept exactly one of two request forms: a named operation, or an
`expression` string evaluated by `internal/parser` (tokenizer →
shunting-yard → RPN evaluator). Both forms converge on the same
`calculator.Registry`, so arithmetic and its error taxonomy have one home.

## Consequences

- Precedence, associativity, unary minus, and `sqrt` are tested server-side,
  including a fuzz target asserting arbitrary bytes never panic
  (`internal/parser/fuzz_test.go`).
- Two request shapes mean the adapter must reject "both" and "neither"; this
  is enforced at the boundary and covered by table tests.
- The parser is a seam for future input modes (voice, OCR) without touching
  the domain, since it depends only on the `parser.Registry` interface.
