# AI Prompts Used in This Project

## Expert roles and team responsibilities

Assign these responsibilities to the relevant AI agent, engineer, or reviewer for each stage.
One contributor may cover multiple roles, but every responsibility must have an explicit owner:

| Role | Responsibility in this project |
| --- | --- |
| Senior product designer | Information hierarchy, visual restraint, brand expression, interaction clarity, and removal of non-essential copy. |
| Human-computer interaction specialist | Familiar calculator behavior, discoverability, input feedback, keyboard parity, and error recovery. |
| Responsive UI engineer | Intrinsic sizing, viewport and aspect-ratio constraints, touch-target preservation, and portrait/landscape continuity. |
| React/TypeScript architect | State ownership, presentational components, dependency boundaries, reusable formatting, and test seams. |
| Go/API engineer | Typed domain errors, HTTP semantics, input limits, rate limiting, timeouts, and configuration. |
| Accessibility specialist | Semantic controls, accessible names, focus behavior, reduced motion, contrast, live regions, and automated WCAG checks. |
| Test and quality engineer | Unit, component, contract, race, fuzz, browser E2E, responsive, and regression coverage. |
| Independent architecture reviewer | Adversarial review of assumptions, edge cases, claims, abstractions, and SOLID evidence. |

## Governing engineering and design principles

Apply these principles to every implementation and review stage:

1. **Single source of truth:** parser expressions remain unchanged in calculator state and at
   the API boundary; mathematical symbols and spoken labels are derived by one presentation
   formatter.
2. **Separation of concerns:** domain arithmetic, expression parsing, HTTP transport,
   calculator state, presentation, theme, and key feedback have distinct owners.
3. **SOLID with concrete evidence:** prefer small consumer-owned interfaces, constructor
   injection, substitutable operations, focused components, and extension tables over switch
   statements scattered across the application.
4. **Ports and adapters:** dependencies point inward; HTTP and React are adapters around the
   calculation rules rather than dependencies of those rules.
5. **KISS and YAGNI:** avoid frameworks, global state, persistence, and abstractions that the
   assignment does not require.
6. **Responsive by construction:** use shared sizing constraints, fluid values, container and
   aspect-ratio rules, and explicit layout modes; do not accumulate device-specific pixel
   patches.
7. **Accessibility as behavior:** keyboard interaction, focus, announcements, contrast,
   reduced motion, and natural spoken math are acceptance criteria, not a final visual audit.
8. **Native-calculator conventions:** zero-seeded operations, `AC`/`C`, repeat equals,
   operator replacement, atomic function deletion, and result continuation should match
   established user expectations unless the web context requires otherwise.
9. **Progressive, restrained motion:** feedback must clarify an action, remain subtle, and be
   disabled when reduced motion is requested.
10. **Defense in depth:** validate at boundaries, cap request size, configure timeouts, avoid
    internal-error leakage, and rate-limit only the expensive public calculation endpoint.
11. **Test behavior and contracts:** assert observable outcomes and stable boundaries; combine
    focused unit tests with a small real-backend browser suite.
12. **Evidence over claims:** documentation, coverage, accessibility, responsiveness, and
    architectural statements must be supported by code, tests, measurements, or references.

---

## Prompt 0 — Project constitution (CLAUDE.md)

> Create a `CLAUDE.md` file at the repository root with the following non-negotiable project
> rules, and obey them in every subsequent task in this session:
>
> **Project:** Full-stack calculator. Backend: Go 1.22+, standard library HTTP only (no web
> frameworks, no DI frameworks, no ORMs). Frontend: React 18 + TypeScript + Vite. Monorepo
> layout: `backend/`, `frontend/`, `docs/`, `docker-compose.yml` at root.
>
> **Architecture (backend) — Hexagonal-lite. Hard rules:**
> 1. `internal/calculator` and `internal/parser` are the domain core. They MUST NOT import
>    `net/http`, `encoding/json`, or anything from `internal/api`. Dependency direction is
>    strictly `api → parser → calculator`.
> 2. `internal/api` is the only inbound adapter. JSON request/response types (DTOs) live in
>    `internal/api/dto.go` and are converted to domain types at the boundary
>    ("parse, don't validate"). Domain types never carry JSON tags.
> 3. All wiring happens in `cmd/server/main.go` (composition root, manual constructor
>    injection).
> 4. Errors: typed sentinel errors in `internal/apperror` (e.g. `ErrDivisionByZero`,
>    `ErrInvalidExpression`). Wrap with `%w` and context. Never return raw 500s for user
>    mistakes: 400 = malformed request, 422 = valid request but domain error.
>
> **Architecture (frontend) — layered. Hard rules:**
> 1. `src/api/` exposes a `CalculatorApi` interface; components never call `fetch` directly.
> 2. All calculator state and logic lives in the `useCalculator` hook; components under
>    `src/components/` are presentational (props in, JSX out).
> 3. No state-management libraries (YAGNI at this scale).
>
> **Quality bar:** table-driven tests in Go, Vitest + React Testing Library on the frontend
> (test behavior, not implementation). Structured logging via `log/slog`. Graceful shutdown.
> `http.MaxBytesReader` and server timeouts. Conventional Commits
> (`feat(backend): …`, `test(frontend): …`).
>
> **Commenting policy (maintainability):** every exported Go symbol gets a godoc comment
> starting with its name; package-level doc comments on `calculator`, `parser`, `api`
> explaining the package's role and its architectural boundary (what it must never import);
> comments explain *why*, never *what* (`// right-associative per standard math convention`,
> not `// loop over tokens`); algorithmic code (shunting-yard) cites its source inline
> (`// Dijkstra, MR 34/61 (1961)`); every trade-off gets a `// NOTE:` (e.g. float64 vs
> decimal); TSDoc on `CalculatorApi`, `useCalculator`, and non-obvious hook logic. No noise
> comments that restate the code — they rot and mislead.
>
> Do not add features, layers, or dependencies beyond what a task asks for. When in doubt,
> prefer the simpler option and leave a `// NOTE:` explaining the trade-off.

---

## Cross-model review protocol (Claude Code × Codex)

Critical decisions in this project were not taken by a single model. At defined checkpoints,
Claude Code produced a structured **review packet**, which I submitted to OpenAI Codex as an
independent reviewer; disagreements were resolved by me and recorded. This mirrors human
engineering practice (design review before merge) and reduces single-model blind spots.

**Checkpoints:** after Prompt 2 (domain model & error taxonomy), Prompt 3 (parser algorithm
& edge cases), Prompt 4 (API contract & status-code mapping), Prompt 6 (accessibility &
design), and before Prompt 8 (final architecture claims).

**Instruction added to each checkpoint prompt for Claude Code:**

> Before I proceed, produce a review packet for an external reviewer: (1) the decision(s)
> just taken and the alternatives you rejected, with one-line rationale each; (2) the public
> surface (interfaces, endpoints, error codes) as a compact listing; (3) the three riskiest
> spots in this stage and what test covers each; (4) two questions you would ask a senior
> reviewer. Keep it under 40 lines.

**Reviewer prompt given to Codex with each packet:**

> You are a senior Go/React reviewer. Below is a design packet from another engineer.
> Challenge it: find incorrect assumptions, missing edge cases, non-idiomatic choices, and
> anything that contradicts the stated architecture rules (hexagonal-lite, domain purity,
> parse-don't-validate). Answer the two questions asked. Be specific — file/type level, no
> generalities. If you agree with a decision, say so in one line and move on.

**Resolution rule:** Codex findings go back to Claude Code verbatim with "address or rebut
each point; for rebuttals give a concrete reason, not preference." Accepted changes are
committed as `refactor(review): …`; rebuttals and the rationale are logged in
`docs/reviews.md`. The log itself is a deliverable — it shows *why* the final design
survived adversarial review.

**Git workflow:** each stage (Prompt 2 onward) is developed on its own branch
(`feat/domain-operations`, `feat/parser`, …) and merged to `main` via a pull request. The
PR description contains that stage's review packet and a summary of the Codex findings with
their resolutions. The result: the repository's history *is* the engineering narrative —
an evaluator can read the PRs in order and watch every decision being made, challenged, and
settled.

---

## Prompt 1 — Repository scaffold

> Scaffold the monorepo per CLAUDE.md. Backend: initialize the Go module
> (`go mod init github.com/<user>/calculator/backend`), create `cmd/server/main.go` with a
> minimal `/health` endpoint, `log/slog` JSON logging, env-based config (PORT, CORS_ORIGIN
> with sane defaults), server timeouts, and graceful shutdown via `signal.NotifyContext`.
> Frontend: Vite + React + TypeScript template, cleaned of boilerplate. Root: `.gitignore`,
> `Makefile` with targets `run-backend`, `run-frontend`, `test`, `cover`, `lint`, and an
> empty `README.md` and `docs/adr/` directory. No business logic yet. Verify both apps start.

---

## Prompt 2 — Domain core: operations

> In `backend/internal/calculator`, implement:
>
> 1. `Operation` interface: `Name() string`, `Arity() int`,
>    `Apply(operands ...float64) (float64, error)`.
> 2. One file per operation: `add.go`, `subtract.go`, `multiply.go`, `divide.go`, `power.go`,
>    `sqrt.go`, `percent.go`. `divide` returns `apperror.ErrDivisionByZero`; `sqrt` of a
>    negative returns `apperror.ErrNegativeSqrt`. Reject NaN/±Inf operands with
>    `apperror.ErrInvalidOperand`; reject results that overflow to ±Inf with
>    `apperror.ErrOverflow`.
> 3. `registry.go`: a read-only-after-construction `Registry` mapping names to operations,
>    plus `Execute(name string, operands ...float64)` as the single entry point (Law of
>    Demeter). Registering a new operation must require zero changes to existing files
>    (Open/Closed).
>
> Tests: table-driven, covering happy paths, every error path, very large/small magnitudes,
> and arity mismatches. Add 2–3 property-based tests with `pgregory.net/rapid`
> (commutativity of add/multiply, `x - x == 0`, `divide(x, y) * y ≈ x` for y ≠ 0).
> Target >90% coverage for this package; run `go test -cover` and show the result.

---

## Prompt 3 — Domain core: expression parser

> In `backend/internal/parser`, implement infix expression evaluation in three small
> components (single responsibility each):
>
> 1. `tokenizer.go` — numbers (including decimals), operators `+ - * / ^ %`, parentheses,
>    identifiers for functions (`sqrt`), unary minus. Syntax errors carry the byte position.
> 2. `shunting_yard.go` — infix → RPN with correct precedence and associativity
>    (`^` right-associative).
> 3. `evaluator.go` — evaluates RPN by delegating every arithmetic step to a
>    `calculator.Registry` passed in via constructor (Dependency Inversion: the parser knows
>    the registry interface, not concrete operations).
>
> Errors: `apperror.ErrSyntax` (with position), `apperror.ErrUnknownFunction`, plus
> propagated domain errors (division by zero inside an expression must surface as
> `ErrDivisionByZero`, not a generic failure).
>
> Tests: table-driven across all three components plus end-to-end `Evaluate(string)` cases:
> precedence (`2+3*4`), parentheses, unary minus (`-3^2`, `2*-3`), nested functions
> (`sqrt(sqrt(16))`), malformed input (`2++3`, `(2+`, `sqrt(-1)`, empty string, whitespace
> only). One property test: for random well-formed expressions built from the grammar,
> evaluation never panics.
>
> **Fuzzing:** add a native Go fuzz test (`FuzzEvaluate`) asserting the safety invariant:
> for arbitrary input bytes, `Evaluate` never panics and always returns either a result or
> a typed error from `apperror`. Seed the corpus with the table-test inputs, run
> `go test -fuzz=FuzzEvaluate -fuzztime=60s`, commit the generated corpus under `testdata/`,
> and fix any crashes found before proceeding.
>
> **Benchmarks:** add `BenchmarkEvaluate` for a representative expression
> (`(2+3)*sqrt(16)-4^2`) reporting ns/op and allocs/op via `b.ReportAllocs()`. Record the
> output — it will be quoted in the README (measured claims only, no adjectives).

---

## Prompt 4 — HTTP adapter

> In `backend/internal/api`, implement the inbound adapter per CLAUDE.md rules:
>
> **Endpoints (all under `/api/v1`):**
> - `POST /api/v1/calculate` — body is either
>   `{"operation": "divide", "operands": [10, 2]}` or `{"expression": "2+3*4"}` (exactly one
>   of the two; reject both/neither with 400). Success: `{"result": 12}`.
> - `GET /api/v1/operations` — list of `{name, arity, symbol}` for UI discovery.
> - `GET /health` — `{"status":"ok"}`.
>
> **Error envelope** (stable machine-readable codes; the frontend renders messages from
> codes, never parses message text):
> `{"error": {"code": "DIVISION_BY_ZERO", "message": "division by zero", "position": 4}}`
> (`position` only for syntax errors). Map: malformed JSON / wrong shape → 400
> `INVALID_REQUEST`; unknown operation → 422 `UNKNOWN_OPERATION`; domain errors → 422 with
> their code; anything else → 500 `INTERNAL` (message redacted, details logged).
>
> **Middleware:** panic recovery, request logging (slog: method, path, status, duration,
> request ID), CORS allowing only the configured origin, `http.MaxBytesReader` (1 KiB body
> limit).
>
> Handlers depend on small interfaces (`Calculator`, `Evaluator`) defined in the api package
> (interface segregation, consumer-side interfaces — idiomatic Go). Wire everything in
> `cmd/server/main.go`. Tests with `net/http/httptest`: every endpoint, every error branch,
> CORS preflight, oversized body. Also write `docs/openapi.yaml` describing the API.
>
> **Contract enforcement:** in the httptest suite, validate every recorded response
> (status, headers, body shape) against `docs/openapi.yaml` using
> `github.com/getkin/kin-openapi`. The spec is a tested artifact, not decoration: if code
> and spec diverge, CI fails. This is the one permitted third-party test dependency.

---

## Prompt 5 — Frontend logic and API layer

> Implement the frontend logic layer (no styling yet — structure and behavior only):
>
> 1. `src/types/api.ts` — request/response and error-envelope types mirroring
>    `docs/openapi.yaml`.
> 2. `src/api/client.ts` — `CalculatorApi` interface + `HttpCalculatorApi` implementation
>    (base URL from `import.meta.env`). Network failures and API error envelopes are
>    normalized into a discriminated union `CalcResult = {ok: true, value} | {ok: false,
>    code, message, position?}` — no exceptions cross this boundary.
> 3. `src/hooks/useCalculator.ts` — owns the expression buffer, cursor-free append/delete/
>    clear, submit (calls the injected `CalculatorApi`), loading flag, last error, and a
>    session history (last 10 results, newest first, re-usable as input). Digits/operators
>    map from both button presses and keyboard events. Error messages are derived from error
>    *codes* via a local dictionary.
> 4. Presentational components (unstyled for now): `Display`, `Keypad`, `Key`,
>    `HistoryPanel`, `App` wiring them to the hook.
> 5. Resilience: wrap the app in a React `ErrorBoundary` (render errors show a recoverable
>    fallback, never a blank screen); `HttpCalculatorApi` applies an `AbortController`
>    timeout (5 s) and surfaces it as `{ok: false, code: "TIMEOUT"}` so the hook can offer
>    retry.
>
> Tests (Vitest + React Testing Library, mock `CalculatorApi` — never mock fetch): typing
> `2+3*4` and submitting shows `14`; division by zero shows the friendly message; network
> failure shows a retryable error; history entries re-populate the input; keyboard Enter
> submits. Test observable behavior only.

---

## Prompt 6 — Visual design pass

> Now style the calculator as a design lead would, not as a template. Constraints first,
> then direction:
>
> **Constraints:** plain CSS (CSS modules or a single `styles.css` — no Tailwind, no UI
> kit); responsive from 360 px up (keypad is a CSS grid that stays thumb-usable on mobile);
> full keyboard operability with visible `:focus-visible` rings; result region uses
> `aria-live="polite"`; every key has an accessible name; respect
> `prefers-reduced-motion`; color contrast ≥ WCAG AA.
>
> **Direction — "precision instrument", not "AI gradient card":** avoid the generic
> AI-generated look (cream background + serif display + terracotta accent, or near-black +
> neon accent). Instead, design this as a physical calculator heritage piece reinterpreted
> for the web: a restrained monochrome-plus-one palette (choose an accent that is *not*
> orange/terracotta and justify it in a CSS comment), a tabular-figures monospace or
> grotesk for the display so digits align and don't jitter, distinct key groups (digits vs
> operators vs actions) expressed through weight and tone rather than rainbow colors, and
> one signature detail: the error state renders the failing expression with the exact
> character position underlined (using the `position` field from the API) — turning error
> handling into the memorable design element.
>
> Micro-interactions: a subtle key-press depress (transform, ≤100 ms), nothing else animated.
> After styling, self-critique against this brief once and remove one decorative element
> that isn't earning its place.

---

## Prompt 7 — Containerization and CI

> 1. `backend/Dockerfile`: multi-stage — build a static binary (`CGO_ENABLED=0`), final
>    stage `gcr.io/distroless/static`, non-root user, `EXPOSE 8080`.
> 2. `frontend/Dockerfile`: multi-stage — `npm ci && npm run build`, final stage nginx
>    serving `dist/` with an `/api/` reverse proxy to the backend service, plus basic
>    security headers and gzip.
> 3. `docker-compose.yml`: services `backend` and `frontend`, healthcheck on
>    `/health`, frontend depends on backend healthy, single command bring-up
>    (`docker compose up` → app on `http://localhost:3000`).
> 4. `.github/workflows/ci.yml`: two jobs — backend (`go vet`, `govulncheck ./...`,
>    `go test -race -cover`, run the fuzz corpus as regular tests, upload coverage summary)
>    and frontend (`npm ci`, `npm audit --audit-level=high`, `npm run lint`, `vitest run
>    --coverage`). Cache modules. Fail on test or vulnerability findings. Add build and
>    coverage status badges to the README header.
>
> Verify the compose stack end-to-end with a curl to `/api/v1/calculate` through the nginx
> proxy.

---

## Prompt 7b — Live deployment

> Deploy the stack so the README can open with a working demo link:
>
> 1. Add a `fly.toml` (or `render.yaml` — pick one, justify in a comment) deploying the
>    backend container with the `/health` endpoint as the platform healthcheck and
>    CORS_ORIGIN set to the frontend's public URL.
> 2. Deploy the frontend build to the same platform (or static hosting) with the API base
>    URL pointing at the deployed backend.
> 3. Smoke-test the live URL: one successful calculation, one division-by-zero returning
>    the 422 envelope, one malformed request returning 400. Paste the three curl outputs
>    into `docs/deployment.md` along with rollback notes (how to redeploy a previous image).
> 4. Add the demo URL to the top of the README with a one-line caveat if the free tier has
>    cold starts ("first request may take a few seconds").

---

## Prompt 8 — Documentation

> Write the final documentation. Tone: concise, engineer-to-engineer, no marketing.
>
> 1. `README.md` with sections: overview + screenshot placeholder; quick start (docker
>    compose one-liner) and local dev (Makefile targets); API usage with curl examples for
>    every endpoint including error responses; architecture (Mermaid diagram of
>    browser → nginx → api adapter → parser → calculator, plus the frontend layer diagram);
>    **Design decisions** — a table mapping each SOLID principle to a concrete file/type in
>    this repo with a one-line justification, followed by the other applied principles
>    (hexagonal-lite, parse-don't-validate, 12-factor items, testing pyramid) each with its
>    concrete evidence; **Consciously omitted** — DB, auth, state library, DI framework,
>    metrics/tracing, microservice split — one sentence of rationale each; testing & coverage
>    (how to run, current numbers); future work (decimal precision, OCR input via the
>    existing parser boundary, rate limiting at the proxy).
> 2. README section **"A 10-minute tour of this codebase"**: where the architecture
>    boundary is enforced (name the exact import-rule test), the hardest edge cases and
>    which test covers each (table), the SOLID evidence map (principle → file:line), the
>    end-to-end journey of one error (`ErrDivisionByZero` from `divide.go` → error
>    envelope → underlined position in the UI, with file links), and the three commits that
>    best show the engineering process. Tone rule: locations and facts only — no evaluative
>    verbs ("note that", "appreciate"), no self-praise; the tour points, it never sells.
> 3. `docs/adr/` — five short ADRs (context/decision/consequences, ≤ 15 lines each):
>    001 stdlib over framework; 002 float64 over decimal (with the financial-context
>    caveat); 003 expression parser alongside single-operation endpoint; 004 single service,
>    not a microservice split (interpretation of the brief, modular-monolith stance,
>    microservice-ready characteristics list); 005 hexagonal-lite over classic layered
>    n-tier (anemic service layer argument).
> 4. README additions: quote the measured `BenchmarkEvaluate` numbers (ns/op, allocs/op)
>    in a short Performance note; and write a **"How AI was used"** section (5–8 sentences):
>    which decisions were human (architecture choice, scope discipline, trade-offs), what
>    was generated (boilerplate, test tables), what the Claude Code × Codex cross-review
>    caught (cite one concrete example from `docs/reviews.md`), and a link to
>    `docs/prompts.md`.
> 5. **Evidence rule:** every non-trivial claim in the README and ADRs must be backed by
>    either (a) a citation to an authoritative source from the References appendix below, or
>    (b) verifiable evidence from this repo (a file path, a test name, a coverage number, or
>    a benchmark output). No unreferenced adjectives ("scalable", "robust") anywhere.
> 6. Add a `References` section to the README using the appendix below, and cite entries
>    inline in ADRs (e.g. "\[Fowler, MonolithFirst\]").
> 7. Cross-check: every architectural claim in the README must be true of the code as built.
>    List any mismatches found and fix the code or the doc, whichever is wrong.
> 8. **Reference verification:** for every entry in the References appendix, (a) fetch the
>    URL and confirm it is live and is the claimed source (author, title, year); (b) confirm
>    the claim we attach to it actually appears in that source — if a citation is used to
>    support something the source does not say, fix the claim, not the citation; (c) for
>    offline sources (Dijkstra MR 34/61, Goldberg 1991, IEEE 754-2019, RFC 9110) verify the
>    bibliographic details against at least one independent index. Report the verification
>    result as a checklist in the PR/commit message.

---

## Prompt 9 — API rate limiting and delivery documentation

> This application is being developed for the stated full-stack calculator
> assignment. If rate limiting is appropriate in that context, add it. Keep
> the React/TypeScript and Go architecture clean, maintainable, testable, and
> aligned with the assignment deliverables; ensure the README contains setup,
> run instructions, REST examples, and design decisions.

Implementation constraints used for this stage: protect only the calculation
endpoint; keep health checks available; return an enveloped `429` with
`Retry-After`; use an in-memory token bucket without a production dependency;
make the policy and trusted-proxy behavior environment-configurable; update the
OpenAPI contract, frontend error mapping, tests, Docker configuration, and
README together.

---

## Prompt 10 — Calculator polish and delivery confidence

> Add the next recommended improvements: native calculator input behavior,
> repeat-equals, browser-level end-to-end coverage, rate-limit retry UX,
> accessibility automation, and README presentation. Preserve the existing
> architecture and responsive design.

Implementation constraints used for this stage: keep all input state in
`useCalculator`; keep API header parsing in the HTTP adapter; run Playwright
against the real Go backend; test desktop and mobile Chromium; scan both themes
for WCAG A/AA issues; add CI artifacts; do not perform an external deployment
without repository/hosting authorization.

---

## Prompt 11 — Premium Sezzle product-design direction

> Act as a senior product designer, HCI specialist, and React UI architect. Review current
> calculator-product patterns and use Mobbin or other current references when accessible.
> Redesign the application as a premium, corporate Sezzle calculator with Apple-like clarity,
> spacing, control proportions, and restraint, but do not clone Apple. Remove the purple-led
> palette and unnecessary explanatory copy. Preserve the multicolor line above the display as
> the product signature, use a more vivid Sezzle orange for operator actions, and keep the
> remaining palette neutral. Add light and dark themes through an accessible compact switch.
> Keep the result surface intentionally dark where contrast and hierarchy benefit from it.
>
> Treat the supplied calculator screenshots as interaction and proportion references, not
> assets to copy. Align every numeral and icon optically as well as geometrically. Use subtle
> press feedback for pointer and keyboard input; the motion should feel physical, finish
> quickly, and respect `prefers-reduced-motion`. Preserve the existing architecture and explain
> any design judgment that materially changes behavior.

Acceptance criteria used during this stage: the header retains a readable Sezzle lockup; theme
controls do not dominate on mobile; key groups remain visually distinct; labels and icons are
centered using shared key primitives; and decoration never competes with the calculation.

---

## Prompt 12 — Responsive system, not breakpoint patches

> Responsiveness is a primary requirement. Audit the complete interface across narrow phones,
> common phones, tablets, desktop windows, short landscape viewports, zoomed layouts, and long
> expressions. The header, result display, and complete keypad must preserve one visual system
> and remain usable when either width or height is constrained. Do not fix screenshots with
> isolated device-specific offsets.
>
> Build an intrinsic sizing system using shared CSS custom properties, `clamp()`, container
> constraints, safe viewport units, and explicit portrait/landscape layout modes. Preserve
> touch-target usability while allowing keys and gaps to scale together. Keep the operator rail
> continuous, prevent right-edge clipping, and ensure the display and keypad share the same
> alignment geometry. Long input must reduce through measured density steps; completed results
> that still do not fit should switch to scientific notation without changing the full numeric
> value stored for the next operation.

Verification requested: browser-level desktop and mobile viewport assertions, both themes,
short-landscape coverage, no horizontal page overflow, and screenshots only as evidence rather
than as the source of layout constants.

---

## Prompt 13 — Native calculator interaction model

> Make the calculator behave like a familiar physical or system calculator while retaining the
> expression API. Keep all transition rules in `useCalculator`, not in buttons or display
> components.
>
> Required behavior:
> - An operator pressed on an empty display starts from zero.
> - A pending binary operator is replaced by the newest operator.
> - Decimal input is normalized, duplicate decimal separators are ignored, and leading zeroes
>   stay valid.
> - `AC` is shown only when state is empty; it becomes `C` after input and returns to `AC` after
>   the calculator is fully cleared.
> - A result followed by a digit starts a fresh calculation; a result followed by an operator
>   continues from that result.
> - Repeated equals repeats the final binary operation.
> - Missing closing parentheses are previewed and completed only at submission.
> - Square root wraps the active operand and is displayed as `√(...)`; applying it to an empty
>   calculator uses zero.
> - Backspace treats parser-only function syntax such as `sqrt(` as one logical token once its
>   argument is empty, so implementation text can never appear during deletion.
> - The sign key changes the active operand, percentage remains postfix, and history recall
>   restores the numeric result.
> - Pointer and supported keyboard actions trigger the same key feedback. Unsupported printable
>   keyboard input produces a short, actionable warning.
>
> Add behavior-focused tests for every transition, including result continuation, empty-state
> operations, nested parentheses, square-root deletion with both the button and Backspace,
> stale network responses, retryable errors, and rate-limit countdown behavior.

---

## Prompt 14 — Parser-safe mathematical presentation boundary

> Audit every path that renders or announces an expression: active input, submitted expression,
> scientific result, syntax-error underline, history, and accessible names. Find any place where
> internal parser syntax (`sqrt`, `*`, `/`, ASCII `-`) can leak to the user.
>
> Implement one parser-to-presentation boundary instead of component-specific replacements.
> Calculator state, history data, API requests, repeat-equals logic, and backend error offsets
> must continue to use the untouched parser expression. The presentation layer should derive
> visual math (`√`, `×`, `÷`, `−`) and explicit spoken phrases for assistive technology.
> Preserve source ranges for multi-character parser tokens so an API byte-position error still
> underlines the correct visible glyph after formatting. Make the vocabulary table the single
> extension point for future functions and operators.
>
> Add focused tests for visual formatting, spoken formatting, source-range preservation, faults
> inside multi-character tokens, unexpected-end carets, history rendering, and accessible
> history labels. Then run lint, all frontend unit/component tests, the production build, and
> desktop/mobile Playwright tests against the real Go backend.

---

## Prompt 15 — Final regression audit

> Act as a senior QA engineer and architecture reviewer. Search for bugs similar to the
> square-root deletion issue: partially exposed internal tokens, alternate rendering paths that
> bypass the formatter, inconsistent pointer and keyboard transitions, stale async responses,
> long-result clipping, inaccessible names, and responsive divergence between header, display,
> and keypad. Read the implementation before proposing changes. Separate confirmed defects from
> lower-priority design observations and identify the missing test for each confirmed defect.
>
> When a defect has a shared cause, repair the owning abstraction and add regression coverage;
> do not patch each screenshot or component independently. Preserve user changes, avoid native
> iOS or simulator work, and validate the final web application through lint, unit/component
> tests, production build, accessibility checks, and real-backend desktop/mobile E2E tests.

---

## Appendix — References to cite in README and ADRs

- Cockburn, A. — *Hexagonal Architecture (Ports & Adapters)*, 2005. https://alistair.cockburn.us/hexagonal-architecture/
- Fowler, M. — *MonolithFirst*, 2015. https://martinfowler.com/bliki/MonolithFirst.html
- Fowler, M. — *Microservice Trade-Offs*, 2015. https://martinfowler.com/articles/microservice-trade-offs.html
- Fowler, M. — *TestPyramid*. https://martinfowler.com/bliki/TestPyramid.html
- Dijkstra, E. W. — *Algol 60 translation* (shunting-yard algorithm), Mathematisch Centrum report MR 34/61, 1961.
- King, A. — *Parse, don't validate*, 2019. https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/
- Metz, S. — *The Wrong Abstraction*, 2016. https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction
- Goldberg, D. — *What Every Computer Scientist Should Know About Floating-Point Arithmetic*, ACM Computing Surveys, 1991. (ADR-002 float64 rationale)
- IEEE 754-2019 — floating-point standard (NaN/Inf semantics referenced in operand validation)
- *The Twelve-Factor App*. https://12factor.net (config, logs, processes)
- Go team — *Error handling and Go* & `errors` package docs. https://go.dev/blog/error-handling-and-go
- OWASP — *REST Security Cheat Sheet* (input limits, CORS, error leakage). https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- W3C — *WCAG 2.1* (AA contrast, focus visibility) https://www.w3.org/TR/WCAG21/ and *ARIA live regions* (aria-live on the result display)
- RFC 9110 — *HTTP Semantics* (status code discipline: 400 vs 422 vs 500)
- Testing Library — *Guiding Principles* ("test behavior, not implementation"). https://testing-library.com/docs/guiding-principles/
