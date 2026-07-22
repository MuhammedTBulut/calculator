# CLAUDE.md — Project Constitution

Non-negotiable project rules. Obey them in every task in this repository.

## Project

Full-stack calculator. Backend: Go 1.22+, standard library HTTP only (no web
frameworks, no DI frameworks, no ORMs). Frontend: React 18 + TypeScript + Vite.
Monorepo layout: `backend/`, `frontend/`, `docs/`, `docker-compose.yml` at root.

## Architecture (backend) — Hexagonal-lite. Hard rules

1. `internal/calculator` and `internal/parser` are the domain core. They MUST NOT
   import `net/http`, `encoding/json`, or anything from `internal/api`. Dependency
   direction is strictly `api → parser → calculator`.
2. `internal/api` is the only inbound adapter. JSON request/response types (DTOs)
   live in `internal/api/dto.go` and are converted to domain types at the boundary
   ("parse, don't validate"). Domain types never carry JSON tags.
3. All wiring happens in `cmd/server/main.go` (composition root, manual
   constructor injection).
4. Errors: typed sentinel errors in `internal/apperror` (e.g. `ErrDivisionByZero`,
   `ErrInvalidExpression`). Wrap with `%w` and context. Never return raw 500s for
   user mistakes: 400 = malformed request, 422 = valid request but domain error.

## Architecture (frontend) — layered. Hard rules

1. `src/api/` exposes a `CalculatorApi` interface; components never call `fetch`
   directly.
2. All *calculation* state and logic lives in the `useCalculator` hook: the
   expression buffer, submission, history, errors, and retry. Components under
   `src/components/` receive it as props and must not duplicate or reinterpret
   it. They may own strictly view-local state that cannot exist outside the
   view — DOM measurement and press animation — and cross-cutting UI state
   (theme, key feedback) belongs in its own hook, not in a component.
   (Refined at review checkpoint 5, which found the original "props in, JSX
   out" wording no longer described `Display`'s width measurement; see
   `docs/reviews.md`.)
3. No state-management libraries (YAGNI at this scale).

## Quality bar

- Table-driven tests in Go; Vitest + React Testing Library on the frontend
  (test behavior, not implementation).
- Structured logging via `log/slog`.
- Graceful shutdown.
- `http.MaxBytesReader` and server timeouts.
- Conventional Commits (`feat(backend): …`, `test(frontend): …`).

## Commenting policy (maintainability)

- Every exported Go symbol gets a godoc comment starting with its name.
- Package-level doc comments on `calculator`, `parser`, `api` explaining the
  package's role and its architectural boundary (what it must never import).
- Comments explain *why*, never *what* (`// right-associative per standard math
  convention`, not `// loop over tokens`).
- Algorithmic code (shunting-yard) cites its source inline
  (`// Dijkstra, MR 34/61 (1961)`).
- Every trade-off gets a `// NOTE:` (e.g. float64 vs decimal).
- TSDoc on `CalculatorApi`, `useCalculator`, and non-obvious hook logic.
- No noise comments that restate the code — they rot and mislead.

## Scope discipline

Do not add features, layers, or dependencies beyond what a task asks for. When in
doubt, prefer the simpler option and leave a `// NOTE:` explaining the trade-off.
