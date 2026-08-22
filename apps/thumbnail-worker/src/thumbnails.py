"""Génération de miniatures par type de fichier

Toutes les fonctions shell-out vers des binaires CLI (poppler-utils, ffmpeg, LibreOffice) plutôt
que d'embarquer des bindings natifs
"""

import io
import subprocess
from pathlib import Path

from pdf2image import convert_from_path
from PIL import Image

from .mime_type import file_type_from_mime_type

THUMBNAIL_MAX_SIZE = (480, 480)
VIDEO_FRAME_TIMESTAMP_SECONDS = 5


def _jpeg_bytes_from_image(image: Image.Image) -> bytes:
    image = image.convert("RGB")
    image.thumbnail(THUMBNAIL_MAX_SIZE)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=85)
    return buffer.getvalue()


def thumbnail_from_pdf(pdf_path: str) -> bytes:
    pages = convert_from_path(pdf_path, first_page=1, last_page=1, dpi=100)
    return _jpeg_bytes_from_image(pages[0])


def thumbnail_from_image(image_path: str) -> bytes:
    with Image.open(image_path) as image:
        return _jpeg_bytes_from_image(image)


def thumbnail_from_video(video_path: str, workdir: Path) -> bytes:
    frame_path = workdir / "frame.jpg"
    # -ss avant -i : seek rapide (par index), au prix d'une précision moindre qu'on n'a pas besoin
    # ici. Si la vidéo est plus courte que le timestamp visé, ffmpeg ne produit pas de fichier :
    # on retente à 0s dans ce cas.
    for timestamp in (VIDEO_FRAME_TIMESTAMP_SECONDS, 0):
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-ss",
                str(timestamp),
                "-i",
                video_path,
                "-frames:v",
                "1",
                str(frame_path),
            ],
            check=False,
            capture_output=True,
        )
        if frame_path.exists():
            break
    else:
        raise RuntimeError("ffmpeg n'a produit aucune frame pour cette vidéo")

    with Image.open(frame_path) as image:
        return _jpeg_bytes_from_image(image)


def convert_office_to_pdf(input_path: str, workdir: Path) -> Path:
    subprocess.run(
        [
            "soffice",
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            str(workdir),
            input_path,
        ],
        check=True,
        capture_output=True,
    )
    converted = workdir / f"{Path(input_path).stem}.pdf"
    if not converted.exists():
        raise RuntimeError(f"LibreOffice n'a pas produit de PDF pour {input_path}")
    return converted


def generate(mime_type: str, local_path: str, workdir: Path) -> tuple[bytes | None, Path | None]:
    """Retourne (miniature JPEG, PDF converti), le PDF n'est renseigné que pour DOCX/PPTX
    (voir Document.previewKey), les deux sont `None` pour un format non pris en charge."""
    file_type = file_type_from_mime_type(mime_type)

    if file_type == "pdf":
        return thumbnail_from_pdf(local_path), None
    if file_type == "image":
        return thumbnail_from_image(local_path), None
    if file_type == "video":
        return thumbnail_from_video(local_path, workdir), None
    if file_type in ("docx", "pptx"):
        preview_pdf = convert_office_to_pdf(local_path, workdir)
        return thumbnail_from_pdf(str(preview_pdf)), preview_pdf

    return None, None
