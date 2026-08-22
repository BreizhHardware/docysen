import { z } from "zod";
import { DocumentSummarySchema } from "./document.types.js";

/**
 * Catégorie dérivée de `mimeType`, utilisée comme facette de filtre côté recherche et pour choisir
 * l'icône de fallback côté frontend quand `thumbnailUrl` est absent. Voir `fileTypeFromMimeType()`.
 */
export const FileTypeCategorySchema = z.enum([
  "pdf",
  "image",
  "video",
  "docx",
  "pptx",
  "markdown",
  "other",
]);
export type FileTypeCategory = z.infer<typeof FileTypeCategorySchema>;

/** Query params de GET /search */
export const SearchQuerySchema = z.object({
  q: z.string().max(200).optional(),
  promo: z.string().optional(), // promoId
  subject: z.string().optional(),
  fileType: FileTypeCategorySchema.optional(),
  page: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().positive().max(60).default(24),
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

/**
 * Résultat de recherche : un DocumentSummary enrichi d'une URL de miniature présignée (courte
 * durée), null tant que le thumbnail-worker ne l'a pas générée (fallback icône côté frontend).
 */
export const SearchResultSchema = DocumentSummarySchema.extend({
  thumbnailUrl: z.string().nullable(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

export const SearchResponseSchema = z.object({
  results: z.array(SearchResultSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
