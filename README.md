# Docysen

Plateforme de dépôt et consultation de documents de cours par les étudiants pour les étudiants de l'ISEN Ouest.

## Prérequis

- Node.js 20+
- pnpm
- Docker (Postgres, Redis, Meilisearch, Garage)

## Démarrage

```bash
cp .env.example .env
docker compose up -d postgres garage
pnpm install
pnpm --filter @docysen/db run generate
pnpm --filter @docysen/db run migrate:dev
./infra/garage-init.sh
pnpm --filter @docysen/auth-service run dev    # http://localhost:3001
pnpm --filter @docysen/api-service run dev     # http://localhost:3002
pnpm --filter @docysen/frontend run dev        # http://localhost:5173
```

`infra/garage-init.sh` affiche un `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` générés à la création de la clé : à reporter dans ton `.env` (Garage ne les connaît pas à l'avance, contrairement aux clés `dev-key`/`dev-secret` de `.env.example` qui ne sont que des placeholders).

## Tests

```bash
pnpm --filter @docysen/utils run test
```

Le test d'intégration S3 (`packages/utils/tests/s3.test.ts`) tourne contre un vrai Garage : il se skippe silencieusement (avec un warning) si `docker compose up -d garage` + `./infra/garage-init.sh` n'ont pas été faits.
