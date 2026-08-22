"""Teste le dispatch par mimeType sans dépendre des binaires système (poppler/ffmpeg/LibreOffice) :
chaque générateur réel est mocké, seul le routage dans `generate()` est vérifié ici. Les
générateurs eux-mêmes (thumbnail_from_pdf, etc.) sont des wrappers fins autour d'outils externes,
plus pertinents à couvrir par un test d'intégration avec de vraies fixtures (phase 5, OCR)."""

from pathlib import Path

from src import thumbnails


def test_generate_dispatches_pdf(monkeypatch):
    monkeypatch.setattr(thumbnails, "thumbnail_from_pdf", lambda path: b"jpeg-bytes")
    thumbnail, preview = thumbnails.generate("application/pdf", "doc.pdf", Path("/tmp"))
    assert thumbnail == b"jpeg-bytes"
    assert preview is None


def test_generate_dispatches_image(monkeypatch):
    monkeypatch.setattr(thumbnails, "thumbnail_from_image", lambda path: b"jpeg-bytes")
    thumbnail, preview = thumbnails.generate("image/png", "photo.png", Path("/tmp"))
    assert thumbnail == b"jpeg-bytes"
    assert preview is None


def test_generate_dispatches_video(monkeypatch):
    monkeypatch.setattr(thumbnails, "thumbnail_from_video", lambda path, workdir: b"jpeg-bytes")
    thumbnail, preview = thumbnails.generate("video/mp4", "clip.mp4", Path("/tmp"))
    assert thumbnail == b"jpeg-bytes"
    assert preview is None


def test_generate_dispatches_docx_via_office_conversion(monkeypatch):
    converted = Path("/tmp/doc.pdf")
    monkeypatch.setattr(thumbnails, "convert_office_to_pdf", lambda path, workdir: converted)
    monkeypatch.setattr(thumbnails, "thumbnail_from_pdf", lambda path: b"jpeg-bytes")
    docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    thumbnail, preview = thumbnails.generate(docx, "cours.docx", Path("/tmp"))
    assert thumbnail == b"jpeg-bytes"
    assert preview == converted


def test_generate_returns_none_for_unsupported_type():
    thumbnail, preview = thumbnails.generate("application/zip", "archive.zip", Path("/tmp"))
    assert thumbnail is None
    assert preview is None
