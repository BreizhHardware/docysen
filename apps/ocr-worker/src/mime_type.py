"""Portage Python de packages/utils/src/mimeType.ts (`fileTypeFromMimeType`), copie identique de
apps/thumbnail-worker/src/mime_type.py.
"""

FileTypeCategory = str  # "pdf" | "image" | "video" | "docx" | "pptx" | "markdown" | "other"

_DOCX_MIME_TYPES = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}
_PPTX_MIME_TYPES = {
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-powerpoint",
}
_MARKDOWN_MIME_TYPES = {"text/markdown", "text/x-markdown"}


def file_type_from_mime_type(mime_type: str) -> FileTypeCategory:
    if mime_type == "application/pdf":
        return "pdf"
    if mime_type.startswith("image/"):
        return "image"
    if mime_type.startswith("video/"):
        return "video"
    if mime_type in _MARKDOWN_MIME_TYPES:
        return "markdown"
    if mime_type in _DOCX_MIME_TYPES:
        return "docx"
    if mime_type in _PPTX_MIME_TYPES:
        return "pptx"
    return "other"
