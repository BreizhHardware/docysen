import { z } from "zod";
import { SearchResultSchema } from "./search.types.js";

/**
 * GET /likes : documents likés en détail,
 * pas seulement leurs IDs. Un document liké puis rejeté/supprimé n'apparaît plus ici, comme pour /search qui n'index que les documents approuvés.
 */
export const LikesResponseSchema = z.object({
  likedDocumentIds: z.array(z.string()),
  likedDocuments: z.array(SearchResultSchema),
  favoriteSubjects: z.array(z.string()),
});
export type LikesResponse = z.infer<typeof LikesResponseSchema>;
