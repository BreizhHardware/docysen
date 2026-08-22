import type { FastifyInstance } from "fastify";
import type { DocumentSummary, SearchResult } from "@docysen/types";
import type { Document, Promo, User } from "@docysen/db";
import { getPresignedDownloadUrl } from "@docysen/utils";
import { env } from "../env.js";

type DocumentWithRelations = Document & {
  promo: Pick<Promo, "label">;
  uploadedBy: Pick<User, "firstName" | "lastName">;
};

// Assez longue pour survivre à l'affichage d'une grille/file d'attente sans la recharger à
// chaque scroll, assez courte pour ne pas rester valide indéfiniment une fois affichée.
const THUMBNAIL_URL_EXPIRES_IN_SECONDS = 300;

/** Réutilisé par GET /documents et GET /moderation/queue, mêmes relations à peupler. */
export function toDocumentSummary(document: DocumentWithRelations): DocumentSummary {
  return {
    id: document.id,
    title: document.title,
    subject: document.subject,
    docType: document.docType,
    promoId: document.promoId,
    promoLabel: document.promo.label,
    semester: document.semester,
    fileName: document.fileName,
    mimeType: document.mimeType,
    fileSize: document.fileSize,
    status: document.status,
    uploadedById: document.uploadedById,
    uploaderName: `${document.uploadedBy.firstName} ${document.uploadedBy.lastName}`,
    createdAt: document.createdAt.toISOString(),
  };
}

/**
 * Même forme que `toDocumentSummary`, enrichie d'une URL de miniature présignée : utilisé partout
 * où le frontend a besoin d'afficher un aperçu (GET /search, GET /moderation/queue).
 */
export async function toDocumentSummaryWithThumbnail(
  fastify: FastifyInstance,
  document: DocumentWithRelations & { thumbnailKey: string | null },
): Promise<SearchResult> {
  const thumbnailUrl = document.thumbnailKey
    ? await getPresignedDownloadUrl(fastify.s3, {
        bucket: env.S3_BUCKET,
        key: document.thumbnailKey,
        expiresInSeconds: THUMBNAIL_URL_EXPIRES_IN_SECONDS,
      })
    : null;
  return { ...toDocumentSummary(document), thumbnailUrl };
}
