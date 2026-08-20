# Docysen

Plateforme de dépôt et consultation de documents de cours par les étudiants pour les étudiants de l'ISEN Ouest.

## Prérequis

- Node.js 20+
- pnpm
- Docker (Postgres, Redis, Meilisearch, Garage)

## Démarrage (phase 1, auth uniquement)

```bash
cp .env.example .env
docker compose up -d postgres
pnpm install
pnpm --filter @docysen/db run generate
pnpm --filter @docysen/db run migrate:dev
pnpm --filter @docysen/auth-service run dev    # http://localhost:3001
pnpm --filter @docysen/frontend run dev        # http://localhost:5173
```

## Tests

```bash
pnpm --filter @docysen/utils run test
```
