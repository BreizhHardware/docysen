import type { FastifyInstance } from "fastify";
import { SearchQuerySchema, type SearchResponse, type SearchResult } from "@docysen/types";
import { requireAuth } from "../middleware/auth.js";
import { toDocumentSummaryWithThumbnail } from "../lib/documentSummary.js";
import { DOCUMENTS_INDEX } from "../plugins/meilisearch.js";

const DOCUMENT_INCLUDE = {
  promo: { select: { label: true } },
  uploadedBy: { select: { firstName: true, lastName: true } },
} as const;

/** Un `"` ou `\` non échappé casserait la syntaxe de filtre Meilisearch (`champ = "valeur"`). */
function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export default async function searchRoutes(fastify: FastifyInstance) {
  /** Peuple le dropdown de matières du formulaire de recherche. */
  fastify.get("/subjects", { preHandler: requireAuth }, async (_request, reply) => {
    const rows = await fastify.prisma.document.findMany({
      where: { status: "approved" },
      select: { subject: true },
      distinct: ["subject"],
      orderBy: { subject: "asc" },
    });
    return reply.send(rows.map((row) => row.subject));
  });

  /**
   * Grille de résultats consultable par tout étudiant authentifié (pas
   * réservé admin/modérateur, contrairement à /moderation) : seuls des documents `approved` sont
   * indexés (voir lib/search.ts), donc aucun filtre de statut supplémentaire n'est nécessaire ici.
   */
  fastify.get("/search", { preHandler: requireAuth }, async (request, reply) => {
    const parseResult = SearchQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply
        .status(400)
        .send({ error: "Requête invalide", issues: parseResult.error.issues });
    }
    const query = parseResult.data;

    const filters: string[] = [];
    if (query.promo) filters.push(`promoId = "${escapeFilterValue(query.promo)}"`);
    if (query.subject) filters.push(`subject = "${escapeFilterValue(query.subject)}"`);
    if (query.fileType) filters.push(`fileType = "${escapeFilterValue(query.fileType)}"`);

    const hits = await fastify.meili.index(DOCUMENTS_INDEX).search(query.q ?? "", {
      filter: filters.length > 0 ? filters.join(" AND ") : undefined,
      sort: ["createdAt:desc"],
      offset: query.page * query.limit,
      limit: query.limit,
    });

    // Meilisearch ne porte que les champs indexés (voir lib/search.ts) : on réhydrate depuis
    // Postgres pour renvoyer la même forme DocumentSummary que GET /documents, dans l'ordre de
    // pertinence retourné par la recherche.
    const ids = hits.hits.map((hit) => hit.id as string);
    const documents = await fastify.prisma.document.findMany({
      where: { id: { in: ids } },
      include: DOCUMENT_INCLUDE,
    });
    const byId = new Map(documents.map((document) => [document.id, document]));

    // Supprimé entre l'indexation et la requête : ignoré (filter avant le Promise.all plutôt
    // qu'un continue dans la boucle, pour paralléliser les présignatures d'URL de miniature).
    const orderedDocuments = ids
      .map((id) => byId.get(id))
      .filter((document) => document !== undefined);
    const results: SearchResult[] = await Promise.all(
      orderedDocuments.map((document) => toDocumentSummaryWithThumbnail(fastify, document)),
    );

    const body: SearchResponse = {
      results,
      total: hits.estimatedTotalHits ?? results.length,
      page: query.page,
      limit: query.limit,
    };
    return reply.send(body);
  });
}
