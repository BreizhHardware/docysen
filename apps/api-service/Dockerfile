FROM node:24-alpine AS build
WORKDIR /repo
COPY . .

RUN printf '\nnodeLinker: hoisted\n' >> pnpm-workspace.yaml
RUN npm install -g pnpm@12.4.2 && pnpm install --frozen-lockfile

RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" pnpm --filter @docysen/db run generate
RUN pnpm --filter @docysen/api-service run build

RUN cp -rL apps/api-service/node_modules /tmp/workspace-deps

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/api-service/dist ./dist
COPY --from=build /repo/apps/api-service/package.json ./
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /tmp/workspace-deps ./node_modules
COPY --from=build /repo/packages ./packages
EXPOSE 3002

CMD ["node", "--import", "tsx", "dist/main.js"]
