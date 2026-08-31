"""Tests unitaires pour generate_tags(). YAKE est mockée pour isoler la logique de matching."""

from unittest.mock import MagicMock, patch

import pytest

from src.tagger import generate_tags


class TestGenerateTags:
    """Cas sans texte OCR (YAKE ne tourne pas)."""

    def test_always_includes_subject(self):
        tags = generate_tags(
            title="Introduction aux réseaux",
            subject="Réseaux",
            mime_type="application/pdf",
            ocr_text=None,
        )
        assert "réseaux" in tags

    def test_pdf_tag_added(self):
        tags = generate_tags(
            title="Cours",
            subject="Maths",
            mime_type="application/pdf",
            ocr_text=None,
        )
        assert "pdf" in tags

    def test_video_tag_added(self):
        tags = generate_tags(
            title="Demo",
            subject="Robotique",
            mime_type="video/mp4",
            ocr_text=None,
        )
        assert "vidéo" in tags

    def test_image_tag_added(self):
        tags = generate_tags(
            title="Schema",
            subject="Électronique",
            mime_type="image/png",
            ocr_text=None,
        )
        assert "image" in tags

    def test_word_tag_added(self):
        tags = generate_tags(
            title="Rapport",
            subject="Management",
            mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ocr_text=None,
        )
        assert "word" in tags

    def test_unknown_mime_no_crash(self):
        tags = generate_tags(
            title="Fichier inconnu",
            subject="Informatique",
            mime_type="application/x-custom-format",
            ocr_text=None,
        )
        assert "informatique" in tags
        # Aucun tag technique pour ce mimeType
        assert "pdf" not in tags

    def test_title_matched_against_known_subjects(self):
        """Un titre contenant un alias de matière connue doit générer le tag canonique."""
        tags = generate_tags(
            title="Introduction au machine learning",
            subject="Autre",
            mime_type="application/pdf",
            ocr_text=None,
        )
        assert "intelligence artificielle" in tags

    def test_subject_normalized_to_lowercase(self):
        tags = generate_tags(
            title="Cours",
            subject="PHYSIQUE",
            mime_type="application/pdf",
            ocr_text=None,
        )
        assert "physique" in tags

    def test_empty_subject_no_empty_tag(self):
        tags = generate_tags(
            title="Cours",
            subject="",
            mime_type="application/pdf",
            ocr_text=None,
        )
        assert "" not in tags

    def test_tags_sorted_and_deduplicated(self):
        tags = generate_tags(
            title="Réseaux",
            subject="réseaux",  # même que le titre après normalisation
            mime_type="application/pdf",
            ocr_text=None,
        )
        # "réseaux" ne doit apparaître qu'une fois
        assert tags.count("réseaux") == 1
        # Résultat trié
        assert tags == sorted(tags)


class TestGenerateTagsWithOcr:
    """Cas avec texte OCR — YAKE est mockée pour ne pas dépendre de l'install en CI."""

    def _make_yake_mock(self, keywords: list[tuple[str, float]]):
        """Crée un mock de yake.KeywordExtractor retournant les keywords fournis."""
        mock_extractor = MagicMock()
        mock_extractor.extract_keywords.return_value = keywords
        return mock_extractor

    @patch("src.tagger.yake.KeywordExtractor")
    def test_yake_keywords_matched_to_subjects(self, mock_yake_cls):
        mock_yake_cls.return_value = self._make_yake_mock([
            ("machine learning", 0.05),
            ("réseau de neurones", 0.08),
            ("données d'entraînement", 0.12),
        ])
        tags = generate_tags(
            title="TP noté",
            subject="IA",
            mime_type="application/pdf",
            ocr_text="Texte OCR du document…",
        )
        assert "intelligence artificielle" in tags

    @patch("src.tagger.yake.KeywordExtractor")
    def test_yake_keywords_above_threshold_ignored(self, mock_yake_cls):
        """Keywords avec score > 0.15 (trop génériques selon YAKE) sont écartés."""
        mock_yake_cls.return_value = self._make_yake_mock([
            ("machine learning", 0.20),   # au-dessus du seuil → ignoré
        ])
        tags = generate_tags(
            title="Cours magistral",
            subject="Cours",
            mime_type="application/pdf",
            ocr_text="du texte générique",
        )
        # Le titre ne contient pas de matière connue non plus
        assert "intelligence artificielle" not in tags

    @patch("src.tagger.yake.KeywordExtractor")
    def test_yake_exception_does_not_crash(self, mock_yake_cls):
        """Si YAKE lève une exception, generate_tags continue sans tags YAKE."""
        mock_yake_cls.return_value = self._make_yake_mock([])
        mock_yake_cls.return_value.extract_keywords.side_effect = RuntimeError("YAKE broken")
        tags = generate_tags(
            title="Cours",
            subject="Maths",
            mime_type="application/pdf",
            ocr_text="texte quelconque",
        )
        # Pas de crash, subject toujours présent
        assert "maths" in tags

    @patch("src.tagger.yake.KeywordExtractor")
    def test_empty_ocr_text_skips_yake(self, mock_yake_cls):
        """Un texte OCR vide ne doit pas déclencher YAKE."""
        generate_tags(
            title="Cours",
            subject="Maths",
            mime_type="application/pdf",
            ocr_text="",
        )
        mock_yake_cls.assert_not_called()

    @patch("src.tagger.yake.KeywordExtractor")
    def test_whitespace_only_ocr_text_skips_yake(self, mock_yake_cls):
        generate_tags(
            title="Cours",
            subject="Maths",
            mime_type="application/pdf",
            ocr_text="   \n\t  ",
        )
        mock_yake_cls.assert_not_called()

    @patch("src.tagger.yake.KeywordExtractor")
    def test_multiple_subject_tags_from_yake(self, mock_yake_cls):
        """Plusieurs matières différentes détectées dans le même texte."""
        mock_yake_cls.return_value = self._make_yake_mock([
            ("python", 0.04),
            ("reseaux tcp ip", 0.07),
            ("sql", 0.09),
        ])
        tags = generate_tags(
            title="Polycopié",
            subject="Informatique",
            mime_type="application/pdf",
            ocr_text="cours de python avec bases de données sql et réseaux tcp/ip",
        )
        assert "programmation" in tags
        assert "réseaux" in tags
        assert "bases de données" in tags
