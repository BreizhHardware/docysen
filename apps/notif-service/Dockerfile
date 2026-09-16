FROM node:24-alpine AS build
WORKDIR /repo
COPY . .

RUN printf '\nnodeLinker: hoisted\n' >> pnpm-workspace.yaml
RUN npm install -g pnpm@12.4.2 && pnpm install --frozen-lockfile
RUN pnpm --filter @docysen/notif-service run build

RUN cp -rL apps/notif-service/node_modules /tmp/workspace-deps

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/notif-service/dist ./dist
COPY --from=build /repo/apps/notif-service/package.json ./
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /tmp/workspace-deps ./node_modules
COPY --from=build /repo/packages ./packages

CMD ["node", "--import", "tsx", "dist/main.js"]
