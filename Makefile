# Local development targets. CI runs the same commands so behavior never diverges.

.PHONY: run-backend run-frontend test cover lint e2e

run-backend:
	cd backend && go run ./cmd/server

run-frontend:
	cd frontend && npm run dev

# --if-present lets these pass until the frontend gains test/coverage scripts.
test:
	cd backend && go test ./...
	cd frontend && npm run test --if-present

cover:
	cd backend && go test -cover ./...
	cd frontend && npm run coverage --if-present

lint:
	cd backend && go vet ./...
	cd frontend && npm run lint

e2e:
	cd frontend && npm run test:e2e
