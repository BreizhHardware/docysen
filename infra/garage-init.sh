#!/usr/bin/env bash
# Bootstrap Garage (dev local ou preprod/prod). À lancer une fois après
# `docker compose up -d garage`. En preprod, passer la vraie origine du frontend :
#   CORS_ALLOWED_ORIGIN=https://preprod.docysen.fr ./infra/garage-init.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER="docysen-garage-1"
BUCKET="${S3_BUCKET:-docysen-dev}"
KEY_NAME="docysen-dev-key"
CORS_ALLOWED_ORIGIN="${CORS_ALLOWED_ORIGIN:-http://localhost:5173}"

garage() { docker exec "$CONTAINER" /garage "$@"; }

echo "Attente de Garage..."
until garage status >/dev/null 2>&1; do sleep 1; done

if garage status | grep -q "NO ROLE ASSIGNED"; then
  NODE_ID=$(garage status | awk '/NO ROLE ASSIGNED/ {print $1}')
  echo "Assignation du layout (nœud unique, dev) : $NODE_ID"
  garage layout assign -z dc1 -c 1G "$NODE_ID"
  garage layout apply --version 1
else
  echo "Layout déjà assigné, on passe."
fi

if ! garage bucket list | grep -q "$BUCKET"; then
  echo "Création du bucket $BUCKET"
  garage bucket create "$BUCKET"
else
  echo "Bucket $BUCKET déjà présent, on passe."
fi

if ! garage key list | grep -q "$KEY_NAME"; then
  echo "Création de la clé d'accès $KEY_NAME"
  KEY_OUTPUT=$(garage key create "$KEY_NAME")
  echo "$KEY_OUTPUT"
  garage bucket allow --read --write --key "$KEY_NAME" "$BUCKET"

  ACCESS_KEY_ID=$(echo "$KEY_OUTPUT" | awk -F': *' '/^Key ID:/ {print $2}')
  SECRET_ACCESS_KEY=$(echo "$KEY_OUTPUT" | awk -F': *' '/^Secret key:/ {print $2}')

  echo "Configuration CORS du bucket pour $CORS_ALLOWED_ORIGIN"
  garage bucket allow --owner --key "$KEY_NAME" "$BUCKET" >/dev/null
  if command -v node >/dev/null 2>&1; then
    S3_ENDPOINT="http://localhost:3900" \
      S3_BUCKET="$BUCKET" \
      AWS_ACCESS_KEY_ID="$ACCESS_KEY_ID" \
      AWS_SECRET_ACCESS_KEY="$SECRET_ACCESS_KEY" \
      CORS_ALLOWED_ORIGIN="$CORS_ALLOWED_ORIGIN" \
      node "$REPO_ROOT/packages/utils/scripts/configure-garage-cors.mjs"
  else
    echo "node introuvable sur l'hôte, exécution du script CORS dans un conteneur éphémère..."
    docker run --rm --network container:"$CONTAINER" \
      -v "$REPO_ROOT/packages/utils/scripts/configure-garage-cors.mjs":/script.mjs:ro \
      -e S3_ENDPOINT="http://localhost:3900" \
      -e S3_BUCKET="$BUCKET" \
      -e AWS_ACCESS_KEY_ID="$ACCESS_KEY_ID" \
      -e AWS_SECRET_ACCESS_KEY="$SECRET_ACCESS_KEY" \
      -e CORS_ALLOWED_ORIGIN="$CORS_ALLOWED_ORIGIN" \
      node:24-alpine sh -c "npm install --no-save --silent @aws-sdk/client-s3 && node /script.mjs"
  fi
  garage bucket deny --owner --key "$KEY_NAME" "$BUCKET" >/dev/null

  echo
  echo "⚠️  Copie AWS_ACCESS_KEY_ID=$ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY=$SECRET_ACCESS_KEY dans ton .env."
else
  echo "Clé $KEY_NAME déjà présente (CORS déjà configuré au premier bootstrap). Pour revoir le secret : docker exec $CONTAINER /garage key info $KEY_NAME --show-secret"
fi
