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

## Checkpoint 2 — Expression parser (Prompt 3, branch `feat/parser`)

- Date: 2026-07-22 · Reviewer: OpenAI Codex (model `gpt-5.6-sol`, Codex CLI 0.145.0)
- Reviewer verdict: "changes requested — the precedence/state-machine design is
  sound, but several claimed invariants are not fully met." All six findings
  accepted; both design questions answered and adopted.

| # | Sev. | Finding | Resolution |
|---|------|---------|------------|
| 1 | Med | Malformed-number errors reported the token start, not the offending byte: `1.2.3` pointed at 0 instead of the second dot at 3 — breaking the underline-the-exact-character contract | **Accepted.** Tokenizer tracks the decimal point and reports the second dot's own byte; `1.2.3` and `12..3` pinned at position 3 (`tokenizer.go`) |
| 2 | Med | Unknown-function resolution was interleaved with execution, so `1/0+foo(4)` and `foo(4)+1/0` returned *different* error classes — expression validity depended on evaluation order, violating parse-don't-validate | **Accepted.** All identifiers resolve before the first `Registry.Execute`; both orderings now return `ErrUnknownFunction`, tested (`evaluator.go`) |
| 3 | Med | `NewEvaluator(nil)` produced an evaluator that panics on `"1+1"`, undermining the never-panic invariant — and the fuzz test could not see it | **Accepted.** `NewEvaluator` returns `(*Evaluator, error)` and rejects a nil registry at the composition root, mirroring `NewRegistry` (`evaluator.go`) |
| 4 | Low | The `subtract(0, x)` negation comment claimed IEEE exactness for *every* finite x — false for `+0`, whose negation loses the sign bit (`-0` → `+0`) | **Accepted.** Signed zero declared intentionally normalized (this calculator treats zero as unsigned); comment corrected and contract pinned with `math.Signbit` test |
| 5 | Low | Tests used only the real registry, so they could not establish the "every arithmetic step delegates" claim — local negation would have passed | **Accepted.** Spy-registry test pins operation names, operand order, call order (`sqrt → subtract(0,2) → percent → add`), and unchanged error propagation (`delegation_test.go`) |
| 6 | Low | A genuine U+FFFD in input was mislabeled "invalid UTF-8 byte" — only a 1-byte `RuneError` means broken encoding | **Accepted.** Tokenizer checks `size == 1`; both cases tested (`tokenizer.go`) |

**Rebuttals:** none at this checkpoint.

**Answers adopted from the reviewer's Q&A:** (a) the permissive grammar stays —
`2--3`, `--3`, `50%%` are unambiguous and compositional; restriction is
presentation policy, which belongs to the UI, not the parser (tests document
the semantics); (b) `SyntaxError.Position == len(input)` for unexpected end
stays, with the valid range defined as `[0, len(input)]` — the frontend should
render the endpoint as an insertion caret. **Forward note for Prompt 5/6:**
positions are *byte* offsets; the frontend must convert before indexing
JavaScript UTF-16 strings.

**Reviewer agreed with:** unary/binary minus classification living in the
shunting-yard (tokenizer stays lexical), the `-`/`^` precedence with no-pop
prefix handling, postfix `%` semantics, the consumer-side `Registry` interface
(domain independence confirmed), and `SyntaxError.Unwrap`.
