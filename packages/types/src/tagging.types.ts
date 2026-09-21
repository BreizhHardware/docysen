import { z } from "zod";

/**
 * Queue BullMQ "tagging" : job produit par api-service (à l'approbation d'un document et/ou à la
 * complétion de l'OCR si le document est déjà approuvé), consommé par tagging-worker. Le texte OCR
 * est passé directement dans le job (pas de download S3) car il est déjà en mémoire. ocrText peut
 * être null si l'OCR n'a pas encore terminé au moment de l'approbation.
 */
export const TaggingJobSchema = z.object({
  documentId: z.string(),
  title: z.string(),
  subject: z.string(),
  mimeType: z.string(),
  ocrText: z.string().nullable(),
});
export type TaggingJob = z.infer<typeof TaggingJobSchema>;

/**
 * Valeur de retour du job, lue par api-service via QueueEvents "completed" sur la queue "tagging".
 * `tags` est une liste de labels normalisés (minuscules, dédoublonnés) à persister via upsert.
 */
export const TaggingResultSchema = z.object({
  documentId: z.string(),
  tags: z.array(z.string()),
});
export type TaggingResult = z.infer<typeof TaggingResultSchema>;
