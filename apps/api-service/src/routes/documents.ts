import { randomUUID } from "node:crypto";

import {
  CreateDocumentSchema,
  OcrJobSchema,
  ThumbnailJobSchema,
  type CreateDocumentResponse,
  type DocumentSummary,
  type PreviewUrlResponse,
} from "@docysen/types";
import { getPresignedDownloadUrl, getPresignedUploadUrl } from "@docysen/utils";
import type { FastifyInstance } from "fastify";

import { env } from "../env.js";
import { toDocumentSummary } from "../lib/documentSummary.js";
import { requireAuth } from "../middleware/auth.js";
import { PROCESSING_QUEUE, THUMBNAILS_QUEUE } from "../plugins/queue.js";

// Caractères hors [a-zA-Z0-9._-] proscrits dans une clé S3/Garage sans encodage supplémentaire.
function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export default async function documentRoutes(fastify: FastifyInstance) {
  /**
   * Étudiant : seulement ses propres documents. Admin/modérateur : tous les documents, pour avoir
   * une vue d'ensemble (voir aussi GET /moderation/queue, restreint aux "pending").
   */
  fastify.get("/documents", { preHandler: requireAuth }, async (request, reply) => {
    const requester = request.user!;
    const documents = await fastify.prisma.document.findMany({
      where: requester.role === "student" ? { uploadedBy: { aurionId: requester.userId } } : {},
      include: {
        promo: { select: { label: true } },
        uploadedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const body: DocumentSummary[] = documents.map(toDocumentSummary);
    return reply.send(body);
  });

  /**
   * Crée le document en base (status "pending") et retourne une URL présignée pour l'upload direct
   * du fichier vers Garage/S3 : le fichier ne transite jamais par api-service.
   */
  fastify.post("/documents", { preHandler: requireAuth }, async (request, reply) => {
    const parseResult = CreateDocumentSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply
        .status(400)
        .send({ error: "Requête invalide", issues: parseResult.error.issues });
    }
    const body = parseResult.data;

    const promo = await fastify.prisma.promo.findUnique({ where: { id: body.promoId } });
    if (!promo) {
      return reply.status(400).send({ error: "Promo inconnue" });
    }
    if (!promo.semesters.includes(body.semester)) {
      return reply.status(400).send({ error: "Semestre inconnu pour cette promo" });
    }

    const uploader = await fastify.prisma.user.findUnique({
      where: { aurionId: request.user!.userId },
    });
    if (!uploader) {
      return reply.status(404).send({ error: "Utilisateur introuvable" });
    }

    const s3Key = `documents/${promo.id}/${randomUUID()}-${sanitizeFileName(body.fileName)}`;

    // URL présignée générée avant l'écriture en base : si Garage/S3 est indisponible, on
    // échoue avant de créer un document "pending" orphelin qui ne sera jamais uploadé.
    const expiresInSeconds = 300;
    const uploadUrl = await getPresignedUploadUrl(fastify.s3, {
      bucket: env.S3_BUCKET,
      key: s3Key,
      contentType: body.mimeType,
      contentLength: body.fileSize,
      expiresInSeconds,
    });

    const document = await fastify.prisma.document.create({
      data: {
        title: body.title,
        subject: body.subject,
        docType: body.docType,
        promoId: promo.id,
        semester: body.semester,
        fileName: body.fileName,
        mimeType: body.mimeType,
        fileSize: body.fileSize,
        s3Key,
        uploadedById: uploader.id,
      },
    });

    const responseBody: CreateDocumentResponse = {
      documentId: document.id,
      uploadUrl,
      s3Key,
      expiresInSeconds,
    };
    return reply.status(201).send(responseBody);
  });

  /**
   * Appelé par le frontend une fois le PUT vers l'URL présignée terminé avec succès : déclenche en
   * parallèle la génération de miniature (queue BullMQ "thumbnails") et l'extraction de texte
   * (queue "processing").
   */
  fastify.post(
    "/documents/:id/confirm-upload",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const document = await fastify.prisma.document.findUnique({ where: { id } });
      if (!document) return reply.status(404).send({ error: "Document introuvable" });

      const requester = await fastify.prisma.user.findUnique({
        where: { aurionId: request.user!.userId },
      });
      if (!requester || document.uploadedById !== requester.id) {
        return reply.status(403).send({ error: "Accès réservé au déposant du document" });
      }

      const jobPayload = {
        documentId: document.id,
        s3Key: document.s3Key,
        mimeType: document.mimeType,
        fileName: document.fileName,
      };
      await Promise.all([
        fastify.thumbnailsQueue.add(THUMBNAILS_QUEUE, ThumbnailJobSchema.parse(jobPayload)),
        fastify.processingQueue.add(PROCESSING_QUEUE, OcrJobSchema.parse(jobPayload)),
      ]);

      return reply.status(202).send({ status: "queued" });
    },
  );

  /**
   * URL présignée GET (courte durée) pour consulter le document dans le navigateur sans le
   * télécharger à part. Sert `previewKey` (PDF converti) au lieu de `s3Key` quand il existe.
   * Accessible au déposant, à tout modérateur/admin, ou à n'importe quel étudiant authentifié si le
   * document est déjà `approved`.
   */
  fastify.get("/documents/:id/preview-url", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const document = await fastify.prisma.document.findUnique({ where: { id } });
    if (!document) return reply.status(404).send({ error: "Document introuvable" });

    const requester = await fastify.prisma.user.findUnique({
      where: { aurionId: request.user!.userId },
    });
    if (!requester) return reply.status(404).send({ error: "Utilisateur introuvable" });

    const isOwner = document.uploadedById === requester.id;
    const isModerator = requester.role === "admin" || requester.role === "moderator";
    const isPubliclyVisible = document.status === "approved";
    if (!isOwner && !isModerator && !isPubliclyVisible) {
      return reply.status(403).send({ error: "Accès réservé" });
    }

    const key = document.previewKey ?? document.s3Key;
    const previewMimeType = document.previewKey ? "application/pdf" : document.mimeType;
    const expiresInSeconds = 60;
    const url = await getPresignedDownloadUrl(fastify.s3, {
      bucket: env.S3_BUCKET,
      key,
      expiresInSeconds,
    });

    const responseBody: PreviewUrlResponse = { url, previewMimeType, expiresInSeconds };
    return reply.send(responseBody);
  });
}
