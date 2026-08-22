# Collection Bruno — Docysen

Ouvre ce dossier (`Bruno/`) comme collection dans [Bruno](https://www.usebruno.com/) (format
[OpenCollection YAML](https://docs.usebruno.com/opencollection-yaml/overview)).

## Setup

1. Environnement : `environments/Local.yml` existe déjà avec les URLs par défaut
   (`http://localhost:3001`/`3002`), rien à faire. Il est **gitignoré** (comme `.env` à la racine) car Bruno y réécrit tes vrais identifiants WebAurion et ton token à chaque usage, `environments/Local.example.yml` est le seul suivi par git, à recopier si tu recrées le tien.
2. Sélectionne l'environnement "Local" dans Bruno, renseigne `username`/`password` (tes vrais identifiants WebAurion — jamais commités, voir point 1).
3. Lance `docker compose up -d postgres garage`, `./infra/garage-init.sh`, `auth-service` et `api-service` (voir README.md racine).

## Utilisation

- **Login** (`auth-service`) en premier : remplit automatiquement `{{token}}`, réutilisé par toutes les requêtes protégées de la collection (`auth: bearer {{token}}`).
- **Create Promo** (`api-service`, admin/modérateur uniquement) : remplit automatiquement `{{promoId}}`, réutilisé par **Create Document**. Par defaut un compte local n'est pas `admin`, pour pouvoir l'utiliser, il faut le passer en `admin` via SQL (exemple ci-dessous, à exécuter dans un client SQL connecté à la base Postgres locale) :
  ```sql
  UPDATE "User" SET role='admin' WHERE "aurionId"='<login WebAurion>';
  ```
- **Create Document** ne fait que créer le document (`status: pending`) et renvoyer une `uploadUrl` présignée, l'upload du fichier lui-même (PUT direct vers Garage/S3) n'est pas couvert par cette collection, voir `packages/utils/tests/s3.test.ts` pour un exemple.
- **Moderation Queue** remplit automatiquement `{{documentId}}` (1er document de la file), réutilisé par **Approve Document** / **Reject Document** / **Moderation History**. Un admin/modérateur peut modérer n'importe quel document, y compris les siens.

## Routes couvertes

| Dossier        | Requête                              | Notes                                                       |
| -------------- | ------------------------------------ | ----------------------------------------------------------- |
| `auth-service` | `GET /health`                        |                                                             |
| `auth-service` | `POST /auth/login`                   |                                                             |
| `auth-service` | `GET /users/me`                      | JWT requis                                                  |
| `auth-service` | `PATCH /users/me/notification-email` | JWT requis                                                  |
| `api-service`  | `GET /health`                        |                                                             |
| `api-service`  | `GET /promos`                        | JWT requis                                                  |
| `api-service`  | `POST /promos`                       | JWT + rôle admin/modérateur                                 |
| `api-service`  | `POST /documents`                    | JWT requis                                                  |
| `api-service`  | `GET /documents`                     | JWT requis (étudiant : les siens ; admin/modérateur : tous) |
| `api-service`  | `GET /moderation/queue`              | JWT + rôle admin/modérateur                                 |
| `api-service`  | `PATCH /moderation/:id/approve`      | JWT + rôle admin/modérateur                                 |
| `api-service`  | `PATCH /moderation/:id/reject`       | JWT + rôle admin/modérateur                                 |
| `api-service`  | `GET /moderation/:id/history`        | JWT requis (auteur ou admin/modérateur)                     |
