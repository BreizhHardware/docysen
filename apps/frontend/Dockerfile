FROM node:24-alpine AS build
WORKDIR /repo
COPY . .

RUN printf '\nnodeLinker: hoisted\n' >> pnpm-workspace.yaml
RUN corepack enable && pnpm install --frozen-lockfile


ARG VITE_API_BASE_URL=/svc/auth
ARG VITE_API_SERVICE_BASE_URL=/svc/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_API_SERVICE_BASE_URL=${VITE_API_SERVICE_BASE_URL}

RUN pnpm --filter @docysen/frontend run build

FROM caddy:2-alpine
COPY --from=build /repo/apps/frontend/dist /srv
COPY apps/frontend/Caddyfile /etc/caddy/Caddyfile
EXPOSE 80
