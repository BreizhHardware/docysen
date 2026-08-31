"""Teste le dispatch par mimeType sans dépendre des binaires/modèles système (Tesseract) : chaque
extracteur réel est mocké, seul le routage dans `extract()` est vérifié ici, sur le même principe
que apps/thumbnail-worker/tests/test_thumbnails.py. Le choix "PDF natif vs scanné" (le seul
morceau de logique non trivial de ce module) est testé à part, avec pdfplumber/pytesseract mockés.
"""

from src import extract as extract_module


def test_extract_dispatches_pdf(monkeypatch):
    monkeypatch.setattr(extract_module, "extract_text_from_pdf", lambda path: "texte pdf")
    text, supported = extract_module.extract("application/pdf", "doc.pdf")
    assert text == "texte pdf"
    assert supported is True


def test_extract_dispatches_image(monkeypatch):
    monkeypatch.setattr(extract_module, "extract_text_from_image", lambda path: "texte image")
    text, supported = extract_module.extract("image/png", "photo.png")
    assert text == "texte image"
    assert supported is True


def test_extract_dispatches_pptx(monkeypatch):
    monkeypatch.setattr(extract_module, "extract_text_from_pptx", lambda path: "texte pptx")
    pptx = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    text, supported = extract_module.extract(pptx, "cours.pptx")
    assert text == "texte pptx"
    assert supported is True


def test_extract_dispatches_docx(monkeypatch):
    monkeypatch.setattr(extract_module, "extract_text_from_docx", lambda path: "texte docx")
    docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    text, supported = extract_module.extract(docx, "cours.docx")
    assert text == "texte docx"
    assert supported is True


def test_extract_dispatches_markdown(monkeypatch):
    monkeypatch.setattr(extract_module, "extract_text_from_markdown", lambda path: "# titre")
    text, supported = extract_module.extract("text/markdown", "notes.md")
    assert text == "# titre"
    assert supported is True


def test_extract_returns_unsupported_for_unknown_type():
    text, supported = extract_module.extract("application/zip", "archive.zip")
    assert text == ""
    assert supported is False


def test_extract_strips_null_bytes_from_extracted_text(monkeypatch):
    # Reproduit un cas réel : pdfplumber a extrait "e\x00ficacité" pour une ligature "effi" mal
    # décodée, et Postgres rejette tout texte contenant un NUL (22021) dans une colonne texte.
    monkeypatch.setattr(
        extract_module, "extract_text_from_pdf", lambda path: "e\x00ficacité garantie"
    )
    text, supported = extract_module.extract("application/pdf", "doc.pdf")
    assert text == "eficacité garantie"
    assert supported is True
    assert "\x00" not in text


def test_extract_returns_unsupported_for_video():
    # Non couvert par le plan (pas d'extraction vidéo) : traité comme un format non pris en
    # charge, comme n'importe quel autre "other" (voir mime_type.py).
    text, supported = extract_module.extract("video/mp4", "clip.mp4")
    assert text == ""
    assert supported is False


class _FakePage:
    def __init__(self, text: str | None):
        self._text = text

    def extract_text(self):
        return self._text


class _FakePdf:
    def __init__(self, pages: list[_FakePage]):
        self.pages = pages

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def test_extract_text_from_pdf_uses_native_text_when_present(monkeypatch):
    native_text = "Un cours de mathématiques avec suffisamment de texte natif extrait."
    monkeypatch.setattr(
        extract_module.pdfplumber, "open", lambda path: _FakePdf([_FakePage(native_text)])
    )
    monkeypatch.setattr(
        extract_module,
        "convert_from_path",
        lambda *a, **k: (_ for _ in ()).throw(AssertionError("ne doit pas être appelé")),
    )

    text = extract_module.extract_text_from_pdf("doc.pdf")
    assert text == native_text


def test_extract_text_from_pdf_falls_back_to_ocr_when_no_native_text(monkeypatch):
    monkeypatch.setattr(extract_module.pdfplumber, "open", lambda path: _FakePdf([_FakePage(None)]))
    monkeypatch.setattr(extract_module, "convert_from_path", lambda path, dpi: ["page-image"])
    monkeypatch.setattr(
        extract_module.pytesseract, "image_to_string", lambda image: "texte océrisé"
    )

    text = extract_module.extract_text_from_pdf("scanne.pdf")
    assert text == "texte océrisé"
