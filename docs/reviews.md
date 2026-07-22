# Cross-Model Review Log

Protocol: [prompts.md — Cross-model review protocol](prompts.md#cross-model-review-protocol).
Claude Code produces a review packet at each checkpoint; OpenAI Codex reviews it
as an independent senior Go/React reviewer with full repo access. Every finding
is addressed or rebutted; accepted changes land as `refactor(review): …` /
`test(review): …` commits, and rebuttals are recorded here with their rationale.

## Checkpoint 1 — Domain operations (Prompt 2, branch `feat/domain-operations`)

- Date: 2026-07-22 · Reviewer: OpenAI Codex (model `gpt-5.6-sol`, Codex CLI 0.145.0)
- Packet: see the stage PR description. Findings below are condensed; resolutions
  reference the code as committed.

| # | Sev. | Finding | Resolution |
|---|------|---------|------------|
| 1 | High | `Registry.Execute` delegated straight to `Apply`, so a non-conforming external `Operation` could bypass arity/finiteness invariants despite the "single entry point" claim | **Accepted.** `Execute` now enforces arity, finite operands, and a finite result itself; built-ins stay defensive because they are exported and directly callable (`registry.go`, `operation.go`) |
| 2 | High | `power(0, negative)` returned `ErrOverflow`, but the IEEE `+Inf` is a pole (`0^-n = 1/0^n`), not magnitude overflow — contradicting `ErrOverflow`'s own definition | **Accepted.** Zero base with negative exponent returns `ErrDivisionByZero`; tests cover `0^-1`, `0^-0.5`, `(-0)^-3` (`power.go`) |
| 3 | Med | No discovery surface for the planned `GET /operations`; the adapter would need a second hard-coded operation table, defeating Open/Closed | **Accepted.** `Registry.Operations() []Info` added (name + arity captured at construction, sorted, defensively copied). Decision recorded: the display `symbol` is adapter-owned presentation metadata, not domain data |
| 4 | Med | `NewRegistry` could panic on a nil `Operation`; calling `Name()` repeatedly let a stateful implementation be validated under one name and stored under another | **Accepted.** Constructor rejects nil operations, empty names, and negative arity; name/arity are read exactly once (`registry.go`) |
| 5 | Med | No tests for misbehaving custom `Operation`s (shadowed name, wrong arity, NaN/Inf with nil error, nil registration) | **Accepted.** `registry_test.go` adds a `rogueOp` violating each invariant plus direct-`Apply` defensiveness tests |
| 6 | Low | Commutativity properties compared only error *presence*, so two different classifications would pass; `1e-9` round-trip tolerance loose enough to hide real bugs | **Accepted.** Properties now compare sentinel classification via `errors.Is`; tolerance tightened to `1e-15` (~4 ulp) (`property_test.go`) |
| 7 | Low | `percent.go` comment claimed equivalence with physical-calculator `%` keys, which are context-sensitive | **Accepted.** Comment reworded to a fixed `x/100` contract with no equivalence claim |

**Rebuttals:** none at this checkpoint.

**Reviewer agreed with:** composition-root registration over `init()`
self-registration, duplicate-name rejection, the small sentinel taxonomy,
NaN-result → `ErrInvalidOperand` mapping, domain import purity (no violations
found), and unary percent semantics (with the comment fix above).

**Answers adopted from the reviewer's Q&A:** (a) every `power(±0, negative)`
maps to `ErrDivisionByZero`; (b) `Execute` enforces arity and finiteness itself
rather than trusting `Apply`.
