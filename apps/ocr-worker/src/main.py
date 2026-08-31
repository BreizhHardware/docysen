"""Consommateur de la queue BullMQ "processing" (voir apps/api-service/src/plugins/queue.ts).
Un job par document uploadé : télécharge l'original depuis S3, extrait son texte et renvoie le résultat comme valeur de retour du job. Pas de réupload :
contrairement à thumbnail-worker, ocr-worker ne touche jamais S3 en écriture.
"""

import asyncio
import logging
import signal
import tempfile
from pathlib import Path

from bullmq import Worker

from .config import load_config
from .extract import extract
from .s3_client import create_s3_client, download_to_file

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ocr-worker")

QUEUE_NAME = "processing"


def make_processor(config):
    s3 = create_s3_client(config)

    async def process(job, _job_token):
        data = job.data
        document_id = data["documentId"]

        with tempfile.TemporaryDirectory() as tmp:
            workdir = Path(tmp)
            original_path = workdir / Path(data["fileName"]).name
            download_to_file(s3, config.s3_bucket, data["s3Key"], str(original_path))

            try:
                text, supported = extract(data["mimeType"], str(original_path))
            except Exception:
                # Un extracteur cassé (PDF corrompu, Tesseract indisponible, ...) ne doit pas
                # bloquer la modération : on retombe sur un texte vide plutôt que de faire
                # échouer le job indéfiniment.
                logger.exception("Échec d'extraction de texte pour %s", document_id)
                text, supported = "", False

        return {"documentId": document_id, "text": text, "supported": supported}

    return process


async def main() -> None:
    config = load_config()
    worker = Worker(QUEUE_NAME, make_processor(config), {"connection": config.redis_url})
    logger.info("ocr-worker démarré, écoute la queue %s", QUEUE_NAME)

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)

    await stop.wait()
    await worker.close()


if __name__ == "__main__":
    asyncio.run(main())
