import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { Queue, QueueEvents } from "bullmq";
import { OcrResultSchema, ThumbnailResultSchema } from "@docysen/types";
import { indexDocument } from "../lib/search.js";
import { env } from "../env.js";

export const THUMBNAILS_QUEUE = "thumbnails";
export const PROCESSING_QUEUE = "processing";

// Tag appliqué automatiquement quand aucun extracteur d'ocr-worker ne sait traiter le mimeType du document
const UNSUPPORTED_FORMAT_TAG = "non-indexé";

declare module "fastify" {
  interface FastifyInstance {
    thumbnailsQueue: Queue;
    processingQueue: Queue;
  }
}

/**
 * Producteurs des queues BullMQ "thumbnails" et "processing" (consommées respectivement par
 * thumbnail-worker et ocr-worker, tous deux Python) + listeners sur leurs complétions pour
 * persister `thumbnailKey`/`previewKey`/`ocrText`. L'écoute se fait via `QueueEvents` plutôt
 * qu'un deuxième `Worker`
 */
export default fp(async (fastify: FastifyInstance) => {
  const connection = { url: env.REDIS_URL };
  const queue = new Queue(THUMBNAILS_QUEUE, { connection });
  const events = new QueueEvents(THUMBNAILS_QUEUE, { connection });
  const processingQueue = new Queue(PROCESSING_QUEUE, { connection });
  const processingEvents = new QueueEvents(PROCESSING_QUEUE, { connection });

  events.on("completed", async ({ jobId }) => {
    try {
      const job = await queue.getJob(jobId);
      if (!job) return;
      const result = ThumbnailResultSchema.parse(job.returnvalue);
      await fastify.prisma.document.update({
        where: { id: result.documentId },
        data: { thumbnailKey: result.thumbnailKey, previewKey: result.previewKey },
      });
    } catch (err) {
      fastify.log.error({ err, jobId }, "Échec de la persistance du résultat de miniature");
    }
  });

  events.on("failed", ({ jobId, failedReason }) => {
    fastify.log.error({ jobId, failedReason }, "Job de génération de miniature échoué");
  });

  processingEvents.on("completed", async ({ jobId }) => {
    try {
      const job = await processingQueue.getJob(jobId);
      if (!job) return;
      const result = OcrResultSchema.parse(job.returnvalue);

      const updated = await fastify.prisma.document.update({
        where: { id: result.documentId },
        data: { ocrText: result.text || null },
        include: { promo: { select: { label: true } } },
      });

      if (updated.status === "approved") {
        await indexDocument(fastify, updated);
      }

      if (!result.supported) {
        const tag = await fastify.prisma.tag.upsert({
          where: { label: UNSUPPORTED_FORMAT_TAG },
          create: { label: UNSUPPORTED_FORMAT_TAG },
          update: {},
        });
        await fastify.prisma.documentTag.upsert({
          where: { documentId_tagId: { documentId: result.documentId, tagId: tag.id } },
          create: { documentId: result.documentId, tagId: tag.id },
          update: {},
        });
      }
    } catch (err) {
      fastify.log.error({ err, jobId }, "Échec de la persistance du résultat OCR");
    }
  });

  processingEvents.on("failed", ({ jobId, failedReason }) => {
    fastify.log.error({ jobId, failedReason }, "Job d'extraction de texte échoué");
  });

  fastify.decorate("thumbnailsQueue", queue);
  fastify.decorate("processingQueue", processingQueue);
  fastify.addHook("onClose", async () => {
    await events.close();
    await queue.close();
    await processingEvents.close();
    await processingQueue.close();
  });
});
