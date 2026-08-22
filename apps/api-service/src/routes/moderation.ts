import type { FastifyInstance } from "fastify";
import {
  RejectDocumentSchema,
  type DocumentSummary,
  type ModerationEvent,
  type SearchResult,
} from "@docysen/types";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { toDocumentSummary, toDocumentSummaryWithThumbnail } from "../lib/documentSummary.js";
import { indexDocument } from "../lib/search.js";

const DOCUMENT_INCLUDE = {
  promo: { select: { label: true } },
  uploadedBy: { select: { firstName: true, lastName: true } },
} as const;

export default async function moderationRoutes(fastify: FastifyInstance) {
  /**
   * File d'attente de modération : "pending" uniquement. 
   * Inclut la miniature (voir toDocumentSummaryWithThumbnail) : un modérateur doit
   * pouvoir consulter le contenu avant de statuer, pas juste les métadonnées
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
