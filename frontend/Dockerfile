# Build stage: produce the static bundle.
FROM node:22-alpine AS build

WORKDIR /app

# npm ci needs both manifests and installs exactly the lockfile's tree.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# No VITE_API_BASE_URL is set: the production bundle falls back to /api/v1,
# which nginx proxies to the backend, so the browser makes same-origin calls
# and no CORS preflight is needed.
RUN npm run build

# Runtime stage: nginx serves the bundle and proxies the API.
FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/snippets/security-headers.conf

EXPOSE 80
