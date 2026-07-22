# Deployment

The calculator is deployed on [Render](https://render.com) as two Docker web
services on the free plan. Render was chosen over Fly.io because the CLI was
already installed and authenticated in this environment — deploying needed no
new account or secret (see the header comment in [`render.yaml`](../render.yaml),
which documents the deployed shape; the services themselves were created with
`render services create`, since the CLI has no blueprint-apply command).

- **Frontend:** <https://sezzle-calculator.onrender.com>
- **Backend API:** <https://sezzle-calculator-api.onrender.com>

Both are built from `feat/documentation` (the tip of the PR stack) with
`autoDeploy: yes` — every push redeploys automatically. Once the PR chain is
merged, point both services at `main` (`render services update
sezzle-calculator --branch main`, and the same for `-api`).

## Topology

Render does not join services on a private Docker network the way
docker-compose does, so the frontend's nginx proxies `/api/*` to the
backend's **public** origin instead of a compose service name. This is one
image, `frontend/Dockerfile`, used both locally and on Render:
`BACKEND_ORIGIN` defaults to the compose hostname and is overridden on
Render to `https://sezzle-calculator-api.onrender.com`; the proxied `Host`
header is derived from that automatically via nginx's `$proxy_host`, so
nothing needs to be kept in sync between two variables.

**Rate limiting caveat:** `TRUST_PROXY` is left `false` on Render. Whether
Render's edge sets `X-Real-IP` is undocumented, and trusting it wrongly would
bucket every visitor under the load balancer's IP — worse than the
already-disclosed per-process limitation described in the README. On this
deployment, the calculation rate limit should be assumed to apply per Render
edge connection pattern, not reliably per visitor.

## What the first deploy attempt caught

Two problems surfaced only once real traffic hit the live services — neither
was visible in `docker compose up`, and both are recorded here because they
are exactly the kind of claim this project's evidence rule expects to be
backed by what actually happened, not by what was intended:

1. **A CLI gap.** `render services create --root-directory frontend
   --runtime docker` has no flag to point at a non-default Dockerfile path.
   The repo's first attempt kept a separate `Dockerfile.render`, which Render
   silently ignored in favor of `./Dockerfile` — the compose-only config.
   Fixed by unifying into one templated Dockerfile (see above) instead of
   maintaining a platform-specific variant.
2. **A routing loop.** `proxy_set_header Host $host;` forwarded the
   *frontend's* own hostname to the backend. The Go server never inspects
   `Host`, so this was invisible locally. Render's shared edge, however,
   routes every `*.onrender.com` request by `Host` header — so the backend
   call arrived carrying the frontend's hostname, Render's router treated it
   as a request *for* the frontend again, and the loop was cut off by
   Render's own guard: `HTTP/2 508` with `x-render-routing: loop`. Fixed by
   forwarding `$proxy_host` (nginx's own record of what `proxy_pass`
   resolved to) instead of `$host`.

Both fixes are in the git history as separate `fix(ops):` commits with the
full diagnosis; this file summarizes the outcome, not the process.

## Smoke tests

Run against the live URLs above, after the routing fix (2026-07-22, UTC):

### 1. Successful calculation

```sh
curl -i https://sezzle-calculator.onrender.com/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"expression":"(2+3)*sqrt(16)"}'
```

```text
HTTP/2 200
content-type: application/json
vary: Origin
x-content-type-options: nosniff
x-frame-options: DENY
x-request-id: 86ef30b81e8b2e19

{"result":20}
```

### 2. Division by zero (422)

```sh
curl -i https://sezzle-calculator.onrender.com/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation":"divide","operands":[1,0]}'
```

```text
HTTP/2 422
content-type: application/json
x-request-id: aa44fad440ebcbd9

{"error":{"code":"DIVISION_BY_ZERO","message":"division by zero"}}
```

### 3. Malformed request (400)

```sh
curl -i https://sezzle-calculator.onrender.com/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{'
```

```text
HTTP/2 400
content-type: application/json
x-request-id: ad1dfb2e922cd890

{"error":{"code":"INVALID_REQUEST","message":"malformed JSON request body"}}
```

All three carry the security headers documented in
[`frontend/security-headers.conf`](../frontend/security-headers.conf) and a
per-request `X-Request-ID` that correlates with the backend's structured
logs. No `x-render-routing: loop` on any response — the fix above holds.

## Cold starts

Both services are on Render's **free plan**. Per Render's own documentation,
a free web service spins down after 15 minutes without inbound traffic, and
spinning back up "takes about one minute," during which Render shows
connecting browsers a loading page
([render.com/docs/free](https://render.com/docs/free#free-web-services)).
The first request after idling is slow for that reason, not an application
issue. The frontend and backend spin down independently, so a cold visit can
in the worst case pay this twice — once for the page to load, again for the
first calculation to reach the backend — before both services are warm. The
README states this plainly next to the demo link rather than leaving a first
visitor to wonder why the page is unresponsive.

## Rollback

Render keeps every prior deploy; rolling back means redeploying an earlier
commit, not reverting git history.

```sh
# Find the commit to roll back to.
render deploys list srv-d9gj7nrtqb8s73djog90 --output json   # frontend
render deploys list srv-d9gj7krbc2fs738l9mlg --output json   # backend

# Redeploy that commit on the affected service.
render deploys create srv-d9gj7nrtqb8s73djog90 --commit <sha> --wait
```

If a bad deploy is mid-rollout, cancel it first:

```sh
render deploys cancel <dep-id>
```

Service IDs (stable across redeploys):

| Service | ID | Dashboard |
| --- | --- | --- |
| `sezzle-calculator` (frontend) | `srv-d9gj7nrtqb8s73djog90` | <https://dashboard.render.com/web/srv-d9gj7nrtqb8s73djog90> |
| `sezzle-calculator-api` (backend) | `srv-d9gj7krbc2fs738l9mlg` | <https://dashboard.render.com/web/srv-d9gj7krbc2fs738l9mlg> |
