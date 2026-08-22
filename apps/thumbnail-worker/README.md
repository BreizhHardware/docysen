# thumbnail-worker

Worker Python (pas de framework, une seule queue) : consomme la queue BullMQ `thumbnails` produite par `api-service` (voir `apps/api-service/src/plugins/queue.ts`) après confirmation d'upload, génère une miniature JPEG (et, pour DOCX/PPTX, une version PDF convertie) et les réuploade sur S3. Le résultat du job (clés S3) est lu par `api-service` via un `QueueEvents`, ce worker ne touche jamais Postgres directement.

## Dépendances système

En plus des paquets Python (`requirements.txt`), ces binaires doivent être installés :

- `poppler-utils` (backend de `pdf2image`, rendu PDF → image)
- `ffmpeg` (extraction de frame vidéo)
- `libreoffice` (conversion DOCX/PPTX → PDF, `soffice --headless`)

Voir `Dockerfile` pour l'installation en conteneur. En dev local (macOS) :

```bash
brew install poppler ffmpeg libreoffice
```

## Dev local

```bash
cd apps/thumbnail-worker
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m src.main
```

La config est lue depuis le `.env` racine du monorepo (mêmes variables que `api-service` :
`REDIS_URL`, `S3_BUCKET`, `S3_ENDPOINT`, `AWS_*`), voir `src/config.py`.

## Tests

```bash
pytest
```

Les tests couvrent le dispatch par `mimeType` (`generate()` dans `src/thumbnails.py`) avec les
générateurs réels mockés — pas de dépendance aux binaires système en CI. Les générateurs eux-mêmes
sont des wrappers fins autour d'outils externes, à couvrir par des tests d'intégration avec de
vraies fixtures si besoin.
