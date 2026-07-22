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

## Checkpoint 3 — HTTP adapter (Prompt 4, branch `feat/http-adapter`)

- Date: 2026-07-22 · Reviewer: OpenAI Codex (model `gpt-5.6-sol`, Codex CLI 0.145.0)
- Reviewer verdict: "changes requested — domain/error dependency direction is
  sound, but the HTTP contract and its enforcement have several concrete gaps."
  Nine findings: **eight accepted, one rebutted** (the log's first rebuttal).

| # | Sev. | Finding | Resolution |
|---|------|---------|------------|
| 1 | High | The contract test left kin-openapi's `Options` nil, so undocumented statuses passed unvalidated — a hypothetical 418 would not have failed the suite; the "headers validated" claim was also false | **Accepted.** `IncludeResponseStatus: true` set; `X-Request-ID` declared on every response in the spec. Request validation deliberately omitted: the suite sends intentionally invalid bodies to exercise 400s (`contract_test.go`) |
| 2 | High | Pointer DTO fields cannot distinguish absent from JSON `null`, so `{"expression":"1+1","operation":null}` slipped past the XOR shape check as 200 | **Accepted.** `json.RawMessage` fields make presence observable; explicit `null` and wrong types are 400s; all three null variants pinned by tests (`dto.go`, `handler.go`) |
| 3 | High | `Decoder.More()` reports false at a stray closing brace, silently accepting `{...} }`; read errors discarded, so whitespace padding could evade the body limit | **Accepted.** Trailing check is now a second `Decode` requiring `io.EOF`, with `MaxBytesError` classified from both decode attempts; `{...} }` and whitespace-padding cases pinned |
| 4 | Med | A syntactically valid JSON number beyond float64 (`1e309`) was misclassified as malformed JSON (400) instead of content outside the domain representation | **Accepted.** Operands decode via `json.Number`; `strconv.ErrRange` maps to 422 `INVALID_OPERAND`, other parse failures stay 400 (`parseOperands`) |
| 5 | Med | The media-type contract was unenforced: `text/plain` bodies were accepted while the spec declared only `application/json` | **Accepted.** Present-but-wrong Content-Type → enveloped 415 `UNSUPPORTED_MEDIA_TYPE`; absent header treated as JSON — leniency documented in the spec |
| 6 | Med | Syntax messages echo the parser's Reason, contradicting the stated "canonical message per code" policy; the spec allowed `position` on every code and did not require it for `SYNTAX_ERROR` | **Accepted (policy revised, schema fixed).** The policy now names SYNTAX_ERROR as its one deliberate exception — Reasons are purpose-built client-facing strings, never internal context. Spec uses a `oneOf`: `position` required for SYNTAX_ERROR, forbidden otherwise |
| 7 | Med | Recovery appended a 500 envelope after a partial response, and the status recorder let a second `WriteHeader` overwrite the logged status — logs could claim 500 where the client got 200 | **Accepted.** First-write-wins recorder; recovery writes the envelope only while the response is unstarted, otherwise abandons the truncated response (guarantee narrowed and documented); partial-write panic test added |
| 8 | Low | Request IDs missing from panic and unhandled-error logs; browsers could not read the echoed header without `Access-Control-Expose-Headers` | **Accepted.** ID rides the request context into both log sites; CORS exposes `X-Request-ID`; all three pinned by tests |
| 9 | Low | `NewHandler`'s nil-checks pass a typed nil stored in an interface | **Rebutted.** Reflection-based typed-nil detection is disproportionate for a constructor guarding the common zero-value wiring mistake; a typed nil is a broken implementer contract and surfaces through the recovery middleware as a logged 500 — exactly the documented behavior for programming errors. The doc comment now states this scope precisely |

**Answers adopted from the reviewer's Q&A:** (a) oversized bodies are **413**
with code `REQUEST_TOO_LARGE` — RFC 9110 defines 413 precisely for this; the
project's 400/422 rule separates malformed from domain, it does not prohibit
other transport statuses. The exact 1024-byte limit is now in the spec.
(b) wrong methods on known routes get an enveloped **405** `METHOD_NOT_ALLOWED`
with the mandatory `Allow` header (HEAD listed explicitly — Go's GET patterns
serve it); unknown paths get an enveloped **404** `NOT_FOUND`. Both are
documented as global transport policy in the spec's info section (OpenAPI 3.0
has no per-operation home for them) and asserted directly in tests.

**Reviewer agreed with:** adapter-owned syntax symbols, canonical redaction
for unexpected errors, 400 for malformed/XOR shape errors, 422 for
empty-operand arity and domain errors, and exact-origin CORS with no grant
for foreign origins.

## Checkpoint 4 — Accessibility & design (Prompt 6, branch `feat/visual-design`)

- Date: 2026-07-22 · Reviewer: OpenAI Codex (model `gpt-5.6-sol`, Codex CLI 0.145.0)
- Reviewer verdict: "changes requested — the visual direction is sound, but the
  global keyboard handling creates two accessibility failures." Seven findings,
  all accepted (two as claim/documentation corrections).

| # | Sev. | Finding | Resolution |
|---|------|---------|------------|
| 1 | High | The window key handler intercepted Enter with preventDefault, so Enter on a focused button (Clear, a digit, Retry, history) submitted instead of activating it — violating the APG button pattern while Space still worked | **Accepted.** Interactive targets keep native Enter/Space; pinned by a test that focuses Clear, presses Enter, and asserts clear-not-submit (`App.tsx`) |
| 2 | High | Page-wide printable-character shortcuts fired regardless of focus, violating WCAG 2.1.4 (no scoping, no disable) | **Accepted.** Printable keys are scoped: with focus inside another interactive component (e.g. history) they are left alone; typing works when the calculator owns focus or nothing interactive does. Pinned by a focus-history-and-type test |
| 3 | Med | Packet overcounted "12 RTL tests" (8 RTL + 4 unit), two tests contradicted the "role/name only" claim via `querySelector('[data-fault]')`, and the caret test proved almost nothing | **Accepted.** Claim corrected here; the `data-fault` queries stay for presentation-detail assertions (documented as such); caret test now asserts class, emptiness, and position after the full expression; added an every-key-has-a-name test (23 names) |
| 4 | Med | The readout is a horizontal scroller, but a fault in a long expression could sit out of view with no keyboard route to scroll it | **Accepted.** Readout is focusable (`tabIndex=0`, arrow-key scrolling per scrollable-region guidance) and the fault scrolls itself into view on render (`Display.tsx`) |
| 5 | Low | "character N" used the UTF-16 index, not the character ordinal — wrong whenever astral characters precede the fault | **Accepted.** `faultRange` now returns `charIndex` (code-point ordinal); the alert uses it; surrogate-pair test pins index 2 ≠ ordinal 1 (`position.ts`) |
| 6 | Low | `KeySpec` let `name` double as accessibility text and control flow, silently mapping unknown null-token keys to Submit; `Key` widened `group` to `string` | **Accepted.** Discriminated union `{kind:'input',token}` / `{kind:'action',action}`; `KeyGroup` union type exported by `Key` (`Keypad.tsx`, `Key.tsx`) |
| 7 | Low | The "accent only for C/needle/error strip" claim omitted Retry | **Accepted (claim revised).** Retry is part of the fault-and-recovery treatment; the CSS header now says so and carries the reviewer's verified contrast figures (6.61:1, 5.48:1, 4.27:1, 4.85:1, 13.5:1, 11.97:1) |

**Answers adopted from the reviewer's Q&A:** (a) the fault character keeps the
normal glyph color — the layering is sound (glyph 13.51:1 on the lamp, needle
≥3:1 against both adjacent colors per WCAG 1.4.11); (b) plain-button Tab
traversal stays — a calculator keypad does not warrant an ARIA grid, which
would impose a composite-widget tab stop and author-managed arrow keys.

**Reviewer agreed with:** the two-tone direction, needle-red accent choice,
tone/weight key grouping, the removed fourth key tone, no-webfont mono stack,
and confirmed no hexagonal-lite/domain-purity/parse-don't-validate violations.

## Checkpoint 5 — Final architecture claims (before Prompt 8, branch `feat/documentation`)

- Date: 2026-07-22 · Reviewer: OpenAI Codex (model `gpt-5.6-sol`, Codex CLI 0.145.0)
- Unlike earlier checkpoints this one reviewed **claims, not just code**: the
  packet listed every architectural assertion about to be published in the
  README and ADRs, and asked which were false or overstated under the evidence
  rule in `docs/prompts.md`. Four were.

| # | Claim under review | Verdict and resolution |
|---|--------------------|------------------------|
| 1 | "Dependency direction is strictly `api → parser → calculator`" | **Overstated.** `internal/api` names `calculator.Info` directly, and both domain packages depend on `internal/apperror`, so the graph is not a chain. **Published instead:** dependencies point *inward* — the domain never references the adapter or transport. |
| 2 | "The domain core imports no transport — enforced" | **Was unenforced.** No import-rule test existed. **Added** `TestDomainImportBoundaries` (+ `TestNothingDependsOnTheAdapter`, `TestDomainCarriesNoJSONTags`) in `backend/internal/architecture_test.go`, using `go/build` so build constraints apply and test-only imports stay legal. Verified to fail when violated. |
| 3 | "Every recorded response is validated against the OpenAPI contract" | **False.** Several suites bypass the validating helper (404/405 tests, isolated middleware tests, composition-root tests, exempt `OPTIONS`), and the spec does not define 404/405 as operation responses. **Published the narrower true scope** in the README's testing section. |
| 4 | "The parser never panics" | **Overstated** — a finite fuzz campaign plus corpus is evidence, not proof. **Published** as panic freedom *for the inputs explored*, quoting the campaign size and corpus count. |
| 5 | "All calculator state lives in `useCalculator`; components are presentational" | **False after the polish stage.** `Display` owns width measurement, `Key` owns its animation, theme and key feedback live in their own hooks. **Resolution:** CLAUDE.md rule refined to separate calculation state (hook, mandatory) from strictly view-local state, and the README states the accurate version. The constitution changed because the code's shape was defensible — not to paper over drift. |
| 6 | LSP claim "every implementation honors the contract" | **Overstated.** The registry *defensively enforces* invariants for any operation; it cannot guarantee semantics. Reworded, citing `TestExecuteEnforcesInvariantsOnNonConformingOperations`. |
| 7 | "Parse, don't validate" at the boundary | **Partially supported.** Presence-aware strict parsing is real, but no domain sum type makes invalid states unrepresentable. README now says exactly that, and cites King's distinction rather than borrowing its strongest form. |
| 8 | Measured evidence | **Inconsistent.** Coverage figures predated the rate-limiting and polish stages, and the benchmark appeared nowhere in the repo. **Re-measured** (backend 88.4%, frontend 94.14%) and the benchmark output is now quoted with its reproduction command. |

**Rebuttals:** none — every finding was accepted.

**Answers adopted from the reviewer's Q&A:** (a) the import-rule test uses
`go/build` rather than `go list -deps` (transitive and text-fragile) or a raw
AST walk (mishandles build constraints); `golang.org/x/tools/go/packages` was
rejected only to avoid a second third-party test dependency. (b) the in-memory
rate limiter is correctly placed in `internal/api`: client identity, admission,
`429`, and `Retry-After` are transport policy. It makes the adapter *stateful*,
not impure — with the constraints (mutex, idle eviction, trusted-proxy
configuration, per-process quota) documented rather than implied.

**Reviewer noted, and the README records:** the limiter wraps the handler, so
malformed and wrong-media-type POSTs to `/api/v1/calculate` also consume quota.

**Reviewer agreed with:** all five planned ADRs as supportable (with 001 scoped
to production backend HTTP and 004 avoiding any claim that frontend and backend
share a process), the status taxonomy, the float64 trade-off with its financial
caveat, the process-local rate-limit disclosure, and that `src/lib` helpers are
genuinely pure.
