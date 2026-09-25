import { z } from "zod";

/**
 * Queue BullMQ "thumbnails" : job produit par api-service (POST /documents/:id/confirm-upload, une
 * fois le fichier bien arrivé sur S3), consommé par thumbnail-worker (Python, Nx).
 */
export const ThumbnailJobSchema = z.object({
  documentId: z.string(),
  s3Key: z.string(),
  mimeType: z.string(),
  fileName: z.string(),
});
export type ThumbnailJob = z.infer<typeof ThumbnailJobSchema>;

/**
 * Valeur de retour du job (`job.returnvalue`), lue par api-service via un `QueueEvents` "completed"
 * sur la queue "thumbnails" pour persister `Document.thumbnailKey`/`previewKey`. `thumbnailKey`
 * reste null pour un format non pris en charge (fallback icône côté frontend) ; `previewKey` n'est
 * renseigné que pour DOCX/PPTX (version PDF convertie par LibreOffice).
 */
export const ThumbnailResultSchema = z.object({
  documentId: z.string(),
  thumbnailKey: z.string().nullable(),
  previewKey: z.string().nullable(),
});
export type ThumbnailResult = z.infer<typeof ThumbnailResultSchema>;
