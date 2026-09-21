import { z } from "zod";

export const DocumentStatusSchema = z.enum(["pending", "approved", "rejected"]);
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

/** Limite d'upload, partagée entre la validation frontend et la policy de l'URL présignée. */
export const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024; // 50 Mo

/**
 * Corps de POST /documents. Promo et semestre sont saisis manuellement par l'étudiant (voir
 * décisions ajoutées à la spec initiale) : WebAurion ne les expose pas de façon fiable.
 */
export const CreateDocumentSchema = z.object({
  title: z.string().min(1).max(200),
  subject: z.string().min(1).max(100),
  docType: z.string().min(1).max(50),
  promoId: z.string().min(1),
  semester: z.string().min(1).max(20),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(MAX_UPLOAD_SIZE_BYTES, "Fichier trop volumineux (50 Mo max)"),
});
export type CreateDocumentBody = z.infer<typeof CreateDocumentSchema>;

/**
 * Réponse de POST /documents : le document est créé en base (status "pending"), reste à uploader le
 * fichier via `uploadUrl`.
 */
export const CreateDocumentResponseSchema = z.object({
  documentId: z.string(),
  uploadUrl: z.string(),
  s3Key: z.string(),
  expiresInSeconds: z.number().int().positive(),
});
export type CreateDocumentResponse = z.infer<typeof CreateDocumentResponseSchema>;

/** Peuple les selects promo/semestre du formulaire d'upload (voir GET /promos). */
export const PromoSummarySchema = z.object({
  id: z.string(),
  label: z.string(),
  semesters: z.array(z.string()),
});
export type PromoSummary = z.infer<typeof PromoSummarySchema>;

/**
 * Corps de POST /promos (admin/modérateur uniquement). Gestion complète (édition, suppression,
 * interface dédiée) prévue en phase 9 ; la création seule est avancée ici pour débloquer l'upload
 * en attendant l'UI d'administration.
 */
export const CreatePromoSchema = z.object({
  label: z.string().min(1).max(100),
  semesters: z.array(z.string().min(1).max(20)).min(1),
});
export type CreatePromoBody = z.infer<typeof CreatePromoSchema>;

/** GET /documents et GET /moderation/queue renvoient tous les deux cette forme. */
export const DocumentSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  subject: z.string(),
  docType: z.string(),
  promoId: z.string(),
  promoLabel: z.string(),
  semester: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  fileSize: z.number().int().nonnegative(),
  status: DocumentStatusSchema,
  uploadedById: z.string(),
  uploaderName: z.string(),
  createdAt: z.string(),
});
export type DocumentSummary = z.infer<typeof DocumentSummarySchema>;

/**
 * Réponse de GET /documents/:id/preview-url. `previewMimeType` diffère de `mimeType` uniquement
 * pour DOCX/PPTX convertis en PDF côté worker : c'est toujours ce champ qu'il faut utiliser pour
 * choisir le viewer côté frontend.
 */
export const PreviewUrlResponseSchema = z.object({
  url: z.string(),
  previewMimeType: z.string(),
  expiresInSeconds: z.number().int().positive(),
});
export type PreviewUrlResponse = z.infer<typeof PreviewUrlResponseSchema>;
