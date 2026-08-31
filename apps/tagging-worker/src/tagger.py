"""Génération de tags pour un document.

Stratégie :
  1. Le champ `subject` fourni par l'étudiant est toujours inclus tel quel (nettoyé).
  2. YAKE extrait des mots-clés du texte OCR (les 5000 premiers caractères pour limiter
     le temps de traitement ; YAKE est O(n) mais les textes longs ralentissent quand même).
  3. Les mots-clés YAKE sont matchés contre SUBJECT_LOOKUP pour trouver les matières connues.
     Un match partiel suffit (le keyword doit contenir l'alias ou l'alias doit contenir le
     keyword, pour attraper "machine learning" dans "deep learning et machine learning").
  4. Le mimeType est converti en tag technique ("pdf", "video", "image", ...) si pertinent.
  5. Les tags sont normalisés (minuscules, strip) et dédoublonnés.
"""

from __future__ import annotations

import unicodedata

import yake

from .subjects import SUBJECT_LOOKUP

# Nombre maximum de mots-clés YAKE extraits
_MAX_YAKE_KEYWORDS = 20
# Tronquer le texte OCR à ce nombre de caractères avant extraction YAKE
_OCR_MAX_CHARS = 5_000
# Score YAKE maximal retenu (YAKE : score bas = meilleur, contrairement à TF-IDF)
_YAKE_SCORE_THRESHOLD = 0.15

# Mapping mimeType → tag technique à ajouter automatiquement
_MIME_TO_TAG: dict[str, str] = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "word",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "powerpoint",
    "text/markdown": "markdown",
}
_MIME_VIDEO_PREFIX = "video/"
_MIME_IMAGE_PREFIX = "image/"


def _normalize(text: str) -> str:
    """Minuscules + suppression des accents pour la comparaison."""
    nfkd = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def _mime_tag(mime_type: str) -> str | None:
    if mime_type in _MIME_TO_TAG:
        return _MIME_TO_TAG[mime_type]
    if mime_type.startswith(_MIME_VIDEO_PREFIX):
        return "vidéo"
    if mime_type.startswith(_MIME_IMAGE_PREFIX):
        return "image"
    return None


def _match_subjects(keywords: list[str]) -> list[str]:
    """Retourne les labels canoniques des matières matchées parmi les mots-clés YAKE."""
    matched: set[str] = set()
    for kw in keywords:
        kw_norm = _normalize(kw)
        for alias, canonical in SUBJECT_LOOKUP.items():
            # Match si l'alias est contenu dans le keyword ou vice-versa
            if alias in kw_norm or kw_norm in alias:
                matched.add(canonical)
    return sorted(matched)


def generate_tags(
    *,
    title: str,
    subject: str,
    mime_type: str,
    ocr_text: str | None,
) -> list[str]:
    """Retourne la liste de tags normalisés (minuscules, dédoublonnés, triés) pour le document.

    Garantie : au moins le tag `subject` est toujours présent (nettoyé).
    """
    tags: set[str] = set()

    # 1. Matière fournie par l'étudiant (toujours présente)
    subject_clean = subject.strip().lower()
    if subject_clean:
        tags.add(subject_clean)

    # 2. Tag technique selon le type MIME
    mime_tag = _mime_tag(mime_type)
    if mime_tag:
        tags.add(mime_tag)

    # 3. Extraction YAKE sur le texte OCR (si disponible)
    if ocr_text and ocr_text.strip():
        text_sample = ocr_text[:_OCR_MAX_CHARS]
        try:
            extractor = yake.KeywordExtractor(
                lan="fr",
                n=3,  # n-grammes jusqu'à 3 mots
                dedupLim=0.9,
                top=_MAX_YAKE_KEYWORDS,
                features=None,
            )
            raw_keywords = extractor.extract_keywords(text_sample)
            # raw_keywords = [(keyword, score), ...], score bas = meilleur
            good_keywords = [kw for kw, score in raw_keywords if score <= _YAKE_SCORE_THRESHOLD]

            # 3a. Matcher les mots-clés contre les matières connues
            subject_tags = _match_subjects(good_keywords)
            tags.update(subject_tags)
        except Exception:
            # YAKE peut échouer sur des textes très courts ou malformés ; on continue sans
            pass

    # 4. Essayer de matcher le titre contre les matières connues (sans YAKE)
    title_subjects = _match_subjects([title])
    tags.update(title_subjects)

    return sorted(tags)
