# ocr-worker

Worker Python (pas de framework, une seule queue) : consomme la queue BullMQ `processing` produite par `api-service` (voir `apps/api-service/src/plugins/queue.ts`) après confirmation d'upload, en parallèle du job `thumbnails` (`thumbnail-worker`). Extrait le texte du document (dispatch par `mimeType`, voir `src/extract.py`) et le renvoie comme valeur de retour du job. Le résultat est lu par `api-service` via un `QueueEvents`, ce worker ne touche jamais Postgres ni S3 en écriture, uniquement le download de l'original.

## Extracteurs

- **PDF natif** : `pdfplumber`, extraction du calque texte de chaque page
- **PDF scanné** : détecté quand le texte natif est trop court (< `NATIVE_TEXT_MIN_LENGTH`) → rendu des pages en image (`pdf2image`) puis OCR Tesseract (`pytesseract`)
- **Image** : OCR Tesseract direct
- **PPTX** : `python-pptx`, texte de toutes les formes avec `text_frame`
- **DOCX** : `python-docx`, texte de tous les paragraphes
- **Markdown** : lu tel quel (déjà du texte)
- **Autre format** (vidéo, archive, ...) : `supported=False`, texte vide, `api-service` applique alors le tag `non-indexé` sur le document

## Dépendances système

En plus des paquets Python (`requirements.txt`), ces binaires doivent être installés :

- `poppler-utils` (backend de `pdf2image`, rendu PDF → image pour l'OCR des PDF scannés)
- `tesseract-ocr` (+ le paquet de langue `fra` pour le français)

Voir `Dockerfile` pour l'installation en conteneur. En dev local (macOS) :

```bash
brew install poppler tesseract tesseract-lang
```

## Dev local

```bash
cd apps/ocr-worker
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m src.main
```

La config est lue depuis le `.env` racine du monorepo (mêmes variables que `thumbnail-worker` : `REDIS_URL`, `S3_BUCKET`, `S3_ENDPOINT`, `AWS_*`), voir `src/config.py`.

## Tests

```bash
pytest
```

Les tests couvrent le dispatch par `mimeType` (`extract()` dans `src/extract.py`, extracteurs réels mockés) et la logique "PDF natif vs scanné" (`extract_text_from_pdf`, avec `pdfplumber`/`pytesseract` mockés) — pas de dépendance aux binaires système en CI. Les extracteurs eux-mêmes sont des wrappers fins autour d'outils externes, à couvrir par des tests d'intégration avec de vraies fixtures si besoin (mêmes réserves que `thumbnail-worker`, voir son README).
