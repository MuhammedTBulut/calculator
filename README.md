# Calculator

[![CI](https://github.com/MuhammedTBulut/calculator/actions/workflows/ci.yml/badge.svg)](https://github.com/MuhammedTBulut/calculator/actions/workflows/ci.yml)
[![backend coverage](https://img.shields.io/badge/backend%20coverage-88%25-brightgreen)](#testing)
[![frontend coverage](https://img.shields.io/badge/frontend%20coverage-92%25-brightgreen)](#testing)

Full-stack calculator: Go standard-library backend, React + TypeScript frontend.

```sh
docker compose up --build   # http://localhost:3000
```

## Testing

Coverage badges quote `go tool cover -func` (whole module, 88.4%) and
`vitest run --coverage` (statements, 92.2%). Both are printed by CI on every
push; reproduce them locally with `make cover`.

Full documentation — architecture, API reference, design decisions, ADRs, and
the measured benchmark numbers — is written in the next stage (Prompt 8).
