import { z } from "zod";

/**
 * Queue BullMQ "processing" : job produit par api-service (POST /documents/:id/confirm-upload,
 * en parallèle du job "thumbnails"), consommé par ocr-worker (Python, Nx).
 */
export const OcrJobSchema = z.object({
  documentId: z.string(),
  s3Key: z.string(),
  mimeType: z.string(),
  fileName: z.string(),
});
export type OcrJob = z.infer<typeof OcrJobSchema>;

/**
 * Valeur de retour du job (`job.returnvalue`), lue par api-service via un `QueueEvents`
 * "completed" sur la queue "processing" pour persister `Document.ocrText`.
 * `supported` distingue un texte vide légitime (page blanche) d'un format non pris en charge
 * par aucun extracteur : dans ce dernier cas, api-service applique le tag `non-indexé`.
 */
export const OcrResultSchema = z.object({
  documentId: z.string(),
  text: z.string(),
  supported: z.boolean(),
});
export type OcrResult = z.infer<typeof OcrResultSchema>;
