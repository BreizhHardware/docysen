import type { Document, Promo } from "@docysen/db";
import { fileTypeFromMimeType } from "@docysen/utils";
import type { FastifyInstance } from "fastify";

import { DOCUMENTS_INDEX } from "../plugins/meilisearch.js";

// Meilisearch indexe le texte intégral mais n'a pas besoin du texte OCR complet (peut être très
// long) : un extrait suffit pour la pertinence de recherche sans alourdir l'index
const OCR_EXCERPT_LENGTH = 2000;

type DocumentWithPromo = Document & { promo: Pick<Promo, "label"> };

/**
 * Indexe (ou ré-indexe) un document `approved` dans Meilisearch. Peut être appelé plusieurs fois
 * sur le même document (à l'approbation, après OCR, après tagging) : Meilisearch remplace le
 * document existant par son id, donc c'est idempotent. Les tags sont fetchés depuis Prisma à chaque
 * appel pour garantir qu'on indexe l'état courant.
 */
export async function indexDocument(
  fastify: FastifyInstance,
  document: DocumentWithPromo,
): Promise<void> {
  const documentTags = await fastify.prisma.documentTag.findMany({
    where: { documentId: document.id },
    include: { tag: { select: { label: true } } },
  });
  const tags = documentTags.map((dt) => dt.tag.label);

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
      tags,
      createdAt: document.createdAt.getTime(),
    },
  ]);
}

/** Retiré de l'index si un document approuvé est ré-évalué */
export async function removeFromIndex(fastify: FastifyInstance, documentId: string): Promise<void> {
  await fastify.meili.index(DOCUMENTS_INDEX).deleteDocument(documentId);
}
