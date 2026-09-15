FROM node:24-alpine AS build
WORKDIR /repo
COPY . .

RUN printf '\nnodeLinker: hoisted\n' >> pnpm-workspace.yaml
RUN corepack enable && pnpm install --frozen-lockfile

RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" pnpm --filter @docysen/db run generate
RUN pnpm --filter @docysen/auth-service run build

RUN cp -rL apps/auth-service/node_modules /tmp/workspace-deps

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/auth-service/dist ./dist
COPY --from=build /repo/apps/auth-service/package.json ./
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /tmp/workspace-deps ./node_modules
COPY --from=build /repo/packages ./packages
EXPOSE 3001

CMD ["node", "--import", "tsx", "dist/main.js"]
