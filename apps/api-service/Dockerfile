FROM node:20-alpine AS build
WORKDIR /repo
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @docysen/db run generate
RUN pnpm --filter @docysen/api-service run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/api-service/dist ./dist
COPY --from=build /repo/apps/api-service/package.json ./
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
EXPOSE 3000
CMD ["node", "dist/main.js"]
