"""Consommateur de la queue BullMQ "thumbnails" (voir apps/api-service/src/plugins/queue.ts).
Un job par document uploadé : télécharge l'original depuis S3, génère une miniature (et,
pour DOCX/PPTX, une version PDF convertie) et les réuploade. Le résultat est renvoyé comme 
valeur de retour du job
"""

import asyncio
import logging
import signal
import tempfile
from pathlib import Path

from bullmq import Worker

from .config import load_config
from .s3_client import create_s3_client, download_to_file, upload_file
from .thumbnails import generate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("thumbnail-worker")

QUEUE_NAME = "thumbnails"


def thumbnail_key(document_id: str) -> str:
    return f"documents-thumbnails/{document_id}.jpg"


def preview_key(document_id: str) -> str:
    return f"documents-previews/{document_id}.pdf"


def make_processor(config):
    s3 = create_s3_client(config)

    async def process(job, _job_token):
        data = job.data
        document_id = data["documentId"]
        result = {"documentId": document_id, "thumbnailKey": None, "previewKey": None}

        with tempfile.TemporaryDirectory() as tmp:
            workdir = Path(tmp)
            original_path = workdir / Path(data["fileName"]).name
            download_to_file(s3, config.s3_bucket, data["s3Key"], str(original_path))

            try:
                thumbnail_bytes, preview_pdf = generate(data["mimeType"], str(original_path), workdir)
            except Exception:
                # Une conversion cassée ne doit pas bloquer la modération : on retombe sur le
                # fallback icône côté frontend plutôt que de faire échouer le job indéfiniment.
                logger.exception("Échec de génération de miniature pour %s", document_id)
                return result

            if thumbnail_bytes is not None:
                thumb_path = workdir / "thumbnail.jpg"
                thumb_path.write_bytes(thumbnail_bytes)
                key = thumbnail_key(document_id)
                upload_file(s3, config.s3_bucket, key, str(thumb_path), "image/jpeg")
                result["thumbnailKey"] = key

            if preview_pdf is not None:
                key = preview_key(document_id)
                upload_file(s3, config.s3_bucket, key, str(preview_pdf), "application/pdf")
                result["previewKey"] = key

        return result

    return process


async def main() -> None:
    config = load_config()
    worker = Worker(QUEUE_NAME, make_processor(config), {"connection": config.redis_url})
    logger.info("thumbnail-worker démarré, écoute la queue %s", QUEUE_NAME)

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)

    await stop.wait()
    await worker.close()


if __name__ == "__main__":
    asyncio.run(main())
