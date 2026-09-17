# tagging-worker

Worker Python qui génère automatiquement des tags pour chaque document approuvé.

## Fonctionnement

Consomme la queue BullMQ `tagging` produite par `api-service` :

- **À l'approbation** du document (si `ocrText` est déjà disponible)
- **Après complétion de l'OCR** (si le document était déjà approuvé)

Les deux cas sont mutuellement exclusifs — un seul job de tagging par cycle approve+OCR.

### Stratégie de tagging

1. La **matière** fournie par l'étudiant est toujours incluse comme tag.
2. Le **type de fichier** est ajouté comme tag technique (`pdf`, `word`, `image`, `vidéo`…).
3. **YAKE** extrait des mots-clés du texte OCR (les 5 000 premiers caractères).
4. Les mots-clés YAKE dont le score ≤ 0.15 sont matchés contre `KNOWN_SUBJECTS` (matières ISEN connues) pour ajouter des tags de matière supplémentaires.
5. Le titre est aussi matché contre `KNOWN_SUBJECTS`.

Tags retournés : minuscules, dédoublonnés, triés alphabétiquement.

## Dépendances système

Aucune dépendance système requise (pas de poppler/tesseract/ffmpeg).

## Développement local

```bash
cd apps/tagging-worker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Démarrer (écoute la queue Redis locale)
python -m src.main

# Tests
pytest
```

## Variables d'environnement

| Variable    | Défaut                   | Description            |
| ----------- | ------------------------ | ---------------------- |
| `REDIS_URL` | `redis://localhost:6379` | URL de connexion Redis |

Chargées depuis le `.env` racine du monorepo.

## Compléter `KNOWN_SUBJECTS`

La liste des matières ISEN est dans `src/subjects.py`. Pour ajouter une nouvelle matière :

```python
(["alias1", "alias2", "alias3"], "Label canonique du tag"),
```

Les alias sont en minuscules sans accents (comparaison normalisée). Relancer les tests après modification.
