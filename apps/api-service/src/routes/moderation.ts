import {
  RejectDocumentSchema,
  type DocumentSummary,
  type ModerationEvent,
  type SearchResult,
} from "@docysen/types";
import { deleteObject } from "@docysen/utils";
import type { FastifyInstance } from "fastify";

import { env } from "../env.js";
import { toDocumentSummary, toDocumentSummaryWithThumbnail } from "../lib/documentSummary.js";
import { indexDocument } from "../lib/search.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { NOTIFICATIONS_QUEUE, TAGGING_QUEUE } from "../plugins/queue.js";

const DOCUMENT_INCLUDE = {
  promo: { select: { label: true } },
  uploadedBy: { select: { firstName: true, lastName: true } },
} as const;

export default async function moderationRoutes(fastify: FastifyInstance) {
  /**
   * File d'attente de modération : "pending" uniquement. Inclut la miniature (voir
   * toDocumentSummaryWithThumbnail) : un modérateur doit pouvoir consulter le contenu avant de
   * statuer, pas juste les métadonnées
   */
  fastify.get(
    "/moderation/queue",
    { preHandler: [requireAuth, requireRole("admin", "moderator")] },
    async (_request, reply) => {
      const documents = await fastify.prisma.document.findMany({
        where: { status: "pending" },
        include: DOCUMENT_INCLUDE,
        orderBy: { createdAt: "asc" },
      });

      const body: SearchResult[] = await Promise.all(
        documents.map((document) => toDocumentSummaryWithThumbnail(fastify, document)),
      );
      return reply.send(body);
    },
  );

  fastify.patch(
    "/moderation/:id/approve",
    { preHandler: [requireAuth, requireRole("admin", "moderator")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const moderator = await fastify.prisma.user.findUnique({
        where: { aurionId: request.user!.userId },
      });
      if (!moderator) return reply.status(404).send({ error: "Utilisateur introuvable" });

      const document = await fastify.prisma.document.findUnique({ where: { id } });
      if (!document) return reply.status(404).send({ error: "Document introuvable" });
      if (document.status !== "pending") {
        return reply.status(409).send({ error: "Ce document a déjà été modéré" });
      }

      // Transaction (forme batch, pas besoin du callback interactif ici) : le changement de
      // statut et l'event de modération doivent être atomiques, ModerationEvent restant
      // insert-only
      const [updated] = await fastify.prisma.$transaction([
        fastify.prisma.document.update({
          where: { id },
          data: { status: "approved" },
          include: DOCUMENT_INCLUDE,
        }),
        fastify.prisma.moderationEvent.create({
          data: { documentId: id, moderatorId: moderator.id, action: "approved" },
        }),
      ]);

      // Seuls les documents "approved" sont recherchables : c'est le seul
      // chemin de code qui fait passer un document dans cet état, donc le seul endroit où indexer.
      await indexDocument(fastify, updated);

      // Déclencher le tagging si l'OCR est déjà terminé (ocrText disponible).
      // Si l'OCR n'est pas encore fini, c'est le listener processingEvents qui enqueiera
      // le job tagging dès la complétion — les deux cas sont mutuellement exclusifs.
      if (updated.ocrText !== null) {
        await fastify.taggingQueue.add(TAGGING_QUEUE, {
          documentId: updated.id,
          title: updated.title,
          subject: updated.subject,
          mimeType: updated.mimeType,
          ocrText: updated.ocrText,
        });
      }

      const body: DocumentSummary = toDocumentSummary(updated);
      return reply.send(body);
    },
  );

  fastify.patch(
    "/moderation/:id/reject",
    { preHandler: [requireAuth, requireRole("admin", "moderator")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parseResult = RejectDocumentSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply
          .status(400)
          .send({ error: "Requête invalide", issues: parseResult.error.issues });
      }
      const { reason } = parseResult.data;

      const moderator = await fastify.prisma.user.findUnique({
        where: { aurionId: request.user!.userId },
      });
      if (!moderator) return reply.status(404).send({ error: "Utilisateur introuvable" });

      const document = await fastify.prisma.document.findUnique({ where: { id } });
      if (!document) return reply.status(404).send({ error: "Document introuvable" });
      if (document.status !== "pending") {
        return reply.status(409).send({ error: "Ce document a déjà été modéré" });
      }

      // On a besoin de l'auteur du document (et de son notificationEmail) pour l'email.
      const uploader = await fastify.prisma.user.findUnique({
        where: { id: document.uploadedById },
        select: { firstName: true, lastName: true, notificationEmail: true },
      });

      const [updated] = await fastify.prisma.$transaction([
        fastify.prisma.document.update({
          where: { id },
          data: { status: "rejected" },
          include: DOCUMENT_INCLUDE,
        }),
        fastify.prisma.moderationEvent.create({
          data: { documentId: id, moderatorId: moderator.id, action: "rejected", reason },
        }),
      ]);

      /**
       * Document rejeté = ne sera jamais consulté : on libère l'espace sur Garage/S3 tout de suite
       * plutôt que d'attendre un job de nettoyage. On lit sur `updated`, pas sur `document`, car le
       * worker thumbnail peut avoir mis à jour ces clés entre-temps (avant que le modérateur ait
       * statué)
       */
      const keysToDelete = [document.s3Key, updated.thumbnailKey, updated.previewKey].filter(
        (key): key is string => key !== null,
      );
      await Promise.all(
        keysToDelete.map((key) =>
          deleteObject(fastify.s3, { bucket: env.S3_BUCKET, key }).catch((err) => {
            fastify.log.error({ err, documentId: id, key }, "Échec suppression objet S3 rejeté");
          }),
        ),
      );

      // Notification par email : no-op silencieux si l'étudiant n'a pas opté in.
      if (uploader?.notificationEmail) {
        await fastify.notificationsQueue.add(NOTIFICATIONS_QUEUE, {
          documentId: updated.id,
          documentTitle: updated.title,
          recipientEmail: uploader.notificationEmail,
          recipientName: `${uploader.firstName} ${uploader.lastName}`,
          reason,
        });
      }

      const body: DocumentSummary = toDocumentSummary(updated);
      return reply.send(body);
    },
  );

  /** Réservé au modérateur/admin ou à l'auteur du document (pour qu'il voie le motif d'un rejet). */
  fastify.get("/moderation/:id/history", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const requester = await fastify.prisma.user.findUnique({
      where: { aurionId: request.user!.userId },
    });
    if (!requester) return reply.status(404).send({ error: "Utilisateur introuvable" });

    const document = await fastify.prisma.document.findUnique({ where: { id } });
    if (!document) return reply.status(404).send({ error: "Document introuvable" });

    const isOwner = document.uploadedById === requester.id;
    const isModerator = requester.role === "admin" || requester.role === "moderator";
    if (!isOwner && !isModerator) {
      return reply.status(403).send({ error: "Accès réservé" });
    }

    const events = await fastify.prisma.moderationEvent.findMany({
      where: { documentId: id },
      include: { moderator: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "asc" },
    });

    const body: ModerationEvent[] = events.map((event) => ({
      id: event.id,
      documentId: event.documentId,
      moderatorId: event.moderatorId,
      moderatorName: `${event.moderator.firstName} ${event.moderator.lastName}`,
      action: event.action,
      reason: event.reason,
      createdAt: event.createdAt.toISOString(),
    }));
    return reply.send(body);
  });
}
