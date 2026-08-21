import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { CreateDocumentSchema, type CreateDocumentResponse } from "@docysen/types";
import { getPresignedUploadUrl } from "@docysen/utils";
import { requireAuth } from "../middleware/auth.js";
import { env } from "../env.js";

// Caractères hors [a-zA-Z0-9._-] proscrits dans une clé S3/Garage sans encodage supplémentaire.
function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export default async function documentRoutes(fastify: FastifyInstance) {
  /**
   * Crée le document en base (status "pending") et retourne une URL présignée pour l'upload
   * direct du fichier vers Garage/S3 : le fichier ne transite jamais par api-service.
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
}
