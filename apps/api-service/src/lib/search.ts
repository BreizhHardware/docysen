import type { FastifyInstance } from "fastify";
import type { Document, Promo } from "@docysen/db";
import { fileTypeFromMimeType } from "@docysen/utils";
import { DOCUMENTS_INDEX } from "../plugins/meilisearch.js";

// Meilisearch indexe le texte intégral mais n'a pas besoin du texte OCR complet (peut être très
// long) : un extrait suffit pour la pertinence de recherche sans alourdir l'index
const OCR_EXCERPT_LENGTH = 2000;

type DocumentWithPromo = Document & { promo: Pick<Promo, "label"> };

/**
 * Déclenché uniquement à l'approbation d'un document (voir routes/moderation.ts) : seuls les
 * documents `approved` sont recherchables
 */
export async function indexDocument(
  fastify: FastifyInstance,
  document: DocumentWithPromo,
): Promise<void> {
  await fastify.meili.index(DOCUMENTS_INDEX).addDocuments([
    {
      id: document.id,
      title: document.title,
      subject: document.subject,
      docType: document.docType,
      promoId: document.promoId,
      promoLabel: document.promo.label,
      semester: document.semester,
      fileName: document.fileName,
      mimeType: document.mimeType,
      fileType: fileTypeFromMimeType(document.mimeType),
      ocrExcerpt: document.ocrText?.slice(0, OCR_EXCERPT_LENGTH) ?? "",
      createdAt: document.createdAt.getTime(),
    },
  ]);
}

/** Retiré de l'index si un document approuvé est ré-évalué */
export async function removeFromIndex(fastify: FastifyInstance, documentId: string): Promise<void> {
  await fastify.meili.index(DOCUMENTS_INDEX).deleteDocument(documentId);
}
