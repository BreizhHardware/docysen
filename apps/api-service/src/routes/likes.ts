import type { LikesResponse } from "@docysen/types";
import type { FastifyInstance } from "fastify";

import { toDocumentSummaryWithThumbnail } from "../lib/documentSummary.js";
import { requireAuth } from "../middleware/auth.js";

const DOCUMENT_INCLUDE = {
  promo: { select: { label: true } },
  uploadedBy: { select: { firstName: true, lastName: true } },
} as const;

export default async function likesRoutes(fastify: FastifyInstance) {
  /**
   * IDs des documents likés + ces mêmes documents en détail, prêts à afficher + les matières
   * favorites. Un document liké puis rejeté/supprimé disparaît de `likedDocuments` : même logique
   * que /search, approved uniquement.
   */
  fastify.get("/likes", { preHandler: requireAuth }, async (request, reply) => {
    const user = await fastify.prisma.user.findUnique({
      where: { aurionId: request.user!.userId },
    });
    if (!user) return reply.status(404).send({ error: "Utilisateur introuvable" });

    const [likes, subjectFavorites] = await Promise.all([
      fastify.prisma.like.findMany({
        where: { userId: user.id },
        select: { documentId: true },
        orderBy: { createdAt: "desc" },
      }),
      fastify.prisma.subjectFavorite.findMany({
        where: { userId: user.id },
        select: { subject: true },
      }),
    ]);

    const likedDocumentIds = likes.map((l) => l.documentId);
    const likedDocumentsById = new Map(
      (
        await fastify.prisma.document.findMany({
          where: { id: { in: likedDocumentIds }, status: "approved" },
          include: DOCUMENT_INCLUDE,
        })
      ).map((document) => [document.id, document]),
    );
    const likedDocuments = await Promise.all(
      likedDocumentIds
        .map((id) => likedDocumentsById.get(id))
        .filter((document) => document !== undefined)
        .map((document) => toDocumentSummaryWithThumbnail(fastify, document)),
    );

    const body: LikesResponse = {
      likedDocumentIds,
      likedDocuments,
      favoriteSubjects: subjectFavorites.map((s) => s.subject),
    };
    return reply.send(body);
  });

  /** Toggle like sur un document (idempotent : double appel = unlike). */
  fastify.post("/likes/documents/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const user = await fastify.prisma.user.findUnique({
      where: { aurionId: request.user!.userId },
    });
    if (!user) return reply.status(404).send({ error: "Utilisateur introuvable" });

    const document = await fastify.prisma.document.findUnique({ where: { id } });
    if (!document) return reply.status(404).send({ error: "Document introuvable" });

    const existing = await fastify.prisma.like.findUnique({
      where: { userId_documentId: { userId: user.id, documentId: id } },
    });

    if (existing) {
      await fastify.prisma.like.delete({
        where: { userId_documentId: { userId: user.id, documentId: id } },
      });
      const count = await fastify.prisma.like.count({ where: { documentId: id } });
      return reply.send({ liked: false, count });
    } else {
      await fastify.prisma.like.create({ data: { userId: user.id, documentId: id } });
      const count = await fastify.prisma.like.count({ where: { documentId: id } });
      return reply.send({ liked: true, count });
    }
  });

  /** Toggle matière favorite (idempotent). */
  fastify.post("/likes/subjects", { preHandler: requireAuth }, async (request, reply) => {
    const { subject } = request.body as { subject?: string };
    if (!subject || typeof subject !== "string" || subject.trim().length === 0) {
      return reply.status(400).send({ error: "Matière invalide" });
    }

    const user = await fastify.prisma.user.findUnique({
      where: { aurionId: request.user!.userId },
    });
    if (!user) return reply.status(404).send({ error: "Utilisateur introuvable" });

    const existing = await fastify.prisma.subjectFavorite.findUnique({
      where: { userId_subject: { userId: user.id, subject: subject.trim() } },
    });

    if (existing) {
      await fastify.prisma.subjectFavorite.delete({
        where: { userId_subject: { userId: user.id, subject: subject.trim() } },
      });
      return reply.send({ favorited: false, subject: subject.trim() });
    } else {
      await fastify.prisma.subjectFavorite.create({
        data: { userId: user.id, subject: subject.trim() },
      });
      return reply.send({ favorited: true, subject: subject.trim() });
    }
  });
}
