"""Consommateur de la queue BullMQ "tagging" (voir apps/api-service/src/plugins/queue.ts).
Un job par document approuvé : génère des tags à partir du titre, de la matière, du mimeType
et du texte OCR (passé directement dans le job, pas de download S3). Retourne la liste de tags
comme valeur de retour du job ; api-service la persiste via QueueEvents "completed".
"""

import asyncio
import logging
import signal

from bullmq import Worker

from .config import load_config
from .tagger import generate_tags

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tagging-worker")

QUEUE_NAME = "tagging"


def make_processor(config):
    async def process(job, _job_token):
        data = job.data
        document_id = data["documentId"]

        try:
            tags = generate_tags(
                title=data.get("title", ""),
                subject=data.get("subject", ""),
                mime_type=data.get("mimeType", ""),
                ocr_text=data.get("ocrText"),
            )
        except Exception:
            logger.exception("Échec de génération de tags pour %s", document_id)
            tags = []

        logger.info("Tags générés pour %s : %s", document_id, tags)
        return {"documentId": document_id, "tags": tags}

    return process


async def main() -> None:
    config = load_config()
    worker = Worker(QUEUE_NAME, make_processor(config), {"connection": config.redis_url})
    logger.info("tagging-worker démarré, écoute la queue %s", QUEUE_NAME)

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)

    await stop.wait()
    await worker.close()


if __name__ == "__main__":
    asyncio.run(main())
