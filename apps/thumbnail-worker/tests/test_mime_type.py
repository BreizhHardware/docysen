from src.mime_type import file_type_from_mime_type


def test_pdf():
    assert file_type_from_mime_type("application/pdf") == "pdf"


def test_image():
    assert file_type_from_mime_type("image/png") == "image"


def test_video():
    assert file_type_from_mime_type("video/mp4") == "video"


def test_markdown():
    assert file_type_from_mime_type("text/markdown") == "markdown"


def test_docx():
    docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    assert file_type_from_mime_type(docx) == "docx"
    assert file_type_from_mime_type("application/msword") == "docx"


def test_pptx():
    pptx = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    assert file_type_from_mime_type(pptx) == "pptx"
    assert file_type_from_mime_type("application/vnd.ms-powerpoint") == "pptx"


def test_other():
    assert file_type_from_mime_type("application/zip") == "other"
