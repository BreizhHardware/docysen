# Docysen

Plateforme de dépôt et consultation de documents de cours par les étudiants pour les étudiants de l'ISEN Ouest.

## Prérequis

- Node.js 24+
- pnpm
- Docker (Postgres, Redis, Meilisearch, Garage)

## Démarrage

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm --filter @docysen/db run generate
pnpm --filter @docysen/db run migrate:dev
./infra/garage-init.sh
pnpm dev # lance tous les services (auth-service, api-service, frontend) en parallèle (frontend sur http://localhost:5173, auth-service sur http://localhost:3001, api-service sur http://localhost:3002)
```

`infra/garage-init.sh` affiche un `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` générés à la création de la clé : à reporter dans ton `.env` (Garage ne les connaît pas à l'avance, contrairement aux clés `dev-key`/`dev-secret` de `.env.example` qui ne sont que des placeholders).

### Se passer admin/modérateur en dev

Le rôle est attribué en base, pas dans l'UI (pas de première inscription "admin"). Une fois connecté au moins une fois (pour que ton compte existe en base), passe-toi admin directement en base :

```bash
docker exec -it docysen-postgres-1 psql -U dev -d docysen \
  -c "UPDATE \"User\" SET role = 'admin' WHERE \"aurionId\" = 'TON_LOGIN_WEBAURION';"
```

Redémarre-toi (déconnexion/reconnexion) pour que le nouveau rôle soit repris dans le token.

## Tests

```bash
pnpm --filter @docysen/utils run test
```

Le test d'intégration S3 (`packages/utils/tests/s3.test.ts`) tourne contre un vrai Garage : il se skippe silencieusement (avec un warning) si `docker compose up -d garage` + `./infra/garage-init.sh` n'ont pas été faits.
