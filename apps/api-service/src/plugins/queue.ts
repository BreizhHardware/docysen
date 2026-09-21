import { OcrResultSchema, TaggingResultSchema, ThumbnailResultSchema } from "@docysen/types";
import { Queue, QueueEvents } from "bullmq";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

import { env } from "../env.js";
import { indexDocument } from "../lib/search.js";

export const THUMBNAILS_QUEUE = "thumbnails";
export const PROCESSING_QUEUE = "processing";
export const TAGGING_QUEUE = "tagging";
export const NOTIFICATIONS_QUEUE = "notifications";

// Tag appliqué automatiquement quand aucun extracteur d'ocr-worker ne sait traiter le mimeType du document
const UNSUPPORTED_FORMAT_TAG = "non-indexé";

declare module "fastify" {
  interface FastifyInstance {
    thumbnailsQueue: Queue;
    processingQueue: Queue;
    taggingQueue: Queue;
    notificationsQueue: Queue;
  }
}

/**
 * Producteurs des queues BullMQ "thumbnails", "processing" et "tagging" (consommées respectivement
 * par thumbnail-worker, ocr-worker et tagging-worker, tous trois Python)
 *
 * - Listeners sur leurs complétions pour persister thumbnailKey/previewKey/ocrText/tags. L'écoute se
 *   fait via QueueEvents plutôt qu'un deuxième Worker.
 *
 * Déclenchement du tagging :
 *
 * - À l'approbation d'un document si ocrText est déjà disponible (OCR terminé avant la modération).
 * - Dans le listener OCR si le document est déjà approved au moment où le résultat arrive. Ces deux
 *   cas sont mutuellement exclusifs : un seul job de tagging par cycle approve+OCR.
 */
export default fp(async (fastify: FastifyInstance) => {
  const connection = { url: env.REDIS_URL };
  const queue = new Queue(THUMBNAILS_QUEUE, { connection });
  const events = new QueueEvents(THUMBNAILS_QUEUE, { connection });
  const processingQueue = new Queue(PROCESSING_QUEUE, { connection });
  const processingEvents = new QueueEvents(PROCESSING_QUEUE, { connection });
  const taggingQueue = new Queue(TAGGING_QUEUE, { connection });
  const taggingEvents = new QueueEvents(TAGGING_QUEUE, { connection });
  const notificationsQueue = new Queue(NOTIFICATIONS_QUEUE, { connection });

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
        // OCR terminé après l'approbation : déclencher le tagging maintenant qu'on a le texte
        await taggingQueue.add("tag-document", {
          documentId: updated.id,
          title: updated.title,
          subject: updated.subject,
          mimeType: updated.mimeType,
          ocrText: updated.ocrText,
        });
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

  taggingEvents.on("completed", async ({ jobId }) => {
    try {
      const job = await taggingQueue.getJob(jobId);
      if (!job) return;
      const result = TaggingResultSchema.parse(job.returnvalue);

      // Persister chaque tag via upsert
      // Les upserts Tag sont parallélisés, les DocumentTag dépendent des ids obtenus.
      const tags = await Promise.all(
        result.tags.map((label) =>
          fastify.prisma.tag.upsert({
            where: { label },
            create: { label },
            update: {},
          }),
        ),
      );
      await Promise.all(
        tags.map((tag) =>
          fastify.prisma.documentTag.upsert({
            where: { documentId_tagId: { documentId: result.documentId, tagId: tag.id } },
            create: { documentId: result.documentId, tagId: tag.id },
            update: {},
          }),
        ),
      );

      fastify.log.info({ documentId: result.documentId, tags: result.tags }, "Tags persistés");

      // Ré-indexer dans Meilisearch pour inclure les tags (indexDocument fetche les tags depuis
      // Prisma, donc cet appel voit les tags qu'on vient de persister ci-dessus).
      const document = await fastify.prisma.document.findUnique({
        where: { id: result.documentId },
        include: { promo: { select: { label: true } } },
      });
      if (document?.status === "approved") {
        await indexDocument(fastify, document);
      }
    } catch (err) {
      fastify.log.error({ err, jobId }, "Échec de la persistance des tags");
    }
  });

  taggingEvents.on("failed", ({ jobId, failedReason }) => {
    fastify.log.error({ jobId, failedReason }, "Job de tagging échoué");
  });

  fastify.decorate("thumbnailsQueue", queue);
  fastify.decorate("processingQueue", processingQueue);
  fastify.decorate("taggingQueue", taggingQueue);
  fastify.decorate("notificationsQueue", notificationsQueue);
  fastify.addHook("onClose", async () => {
    await events.close();
    await queue.close();
    await processingEvents.close();
    await processingQueue.close();
    await taggingEvents.close();
    await taggingQueue.close();
    await notificationsQueue.close();
  });
});
