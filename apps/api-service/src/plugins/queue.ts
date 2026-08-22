import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { Queue, QueueEvents } from "bullmq";
import { ThumbnailResultSchema } from "@docysen/types";
import { env } from "../env.js";

export const THUMBNAILS_QUEUE = "thumbnails";

declare module "fastify" {
  interface FastifyInstance {
    thumbnailsQueue: Queue;
  }
}

/**
 * Producteur de la queue BullMQ "thumbnails" (consommée par thumbnail-worker, Python) + listener
 * sur ses complétions pour persister `thumbnailKey`/`previewKey`. L'écoute
 * se fait via `QueueEvents` plutôt qu'un deuxième `Worker` : api-service ne fait que réagir au
 * résultat, il ne traite pas de jobs lui-même.
 */
export default fp(async (fastify: FastifyInstance) => {
  const connection = { url: env.REDIS_URL };
  const queue = new Queue(THUMBNAILS_QUEUE, { connection });
  const events = new QueueEvents(THUMBNAILS_QUEUE, { connection });

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

  fastify.decorate("thumbnailsQueue", queue);
  fastify.addHook("onClose", async () => {
    await events.close();
    await queue.close();
  });
});
