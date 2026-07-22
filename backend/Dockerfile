# Build stage: compile a fully static binary so the runtime image needs no libc.
FROM golang:1.26-alpine AS build

WORKDIR /src

# Copy manifests first so dependency download caches independently of source.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# CGO off + netgo keeps the binary static; trimpath and -w -s drop local paths
# and debug tables from the shipped artifact.
ENV CGO_ENABLED=0 GOOS=linux
RUN go build -trimpath -ldflags="-w -s" -tags netgo -o /out/server ./cmd/server

# Runtime stage: distroless static has no shell, no package manager, no libc —
# only the binary and CA certificates. The :nonroot tag runs as uid 65532.
FROM gcr.io/distroless/static:nonroot

COPY --from=build /out/server /server

USER nonroot:nonroot
EXPOSE 8080

# The binary probes itself: there is no curl or shell in this image.
HEALTHCHECK --interval=10s --timeout=3s --start-period=2s --retries=3 \
  CMD ["/server", "-healthcheck"]

ENTRYPOINT ["/server"]
