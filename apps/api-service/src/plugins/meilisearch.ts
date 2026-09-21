import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { MeiliSearch } from "meilisearch";

import { env } from "../env.js";

export const DOCUMENTS_INDEX = "documents";

declare module "fastify" {
  interface FastifyInstance {
    meili: MeiliSearch;
  }
}

/**
 * Index unique "documents" pour la recherche full-text (documents `approved` uniquement, voir
 * `indexDocument()` dans lib/search.ts). Idempotent : peut être rappelé sans risque au démarrage.
 */
export async function configureMeilisearch(meili: MeiliSearch): Promise<void> {
  const index = meili.index(DOCUMENTS_INDEX);
  await meili.createIndex(DOCUMENTS_INDEX, { primaryKey: "id" }).catch(() => {
    // Index déjà créé lors d'un précédent démarrage : pas une erreur.
  });
  await index.updateSearchableAttributes(["title", "subject", "tags", "fileName", "ocrExcerpt"]);
  await index.updateFilterableAttributes(["promoId", "subject", "fileType", "tags"]);
  await index.updateSortableAttributes(["createdAt"]);
}

export default fp(async (fastify: FastifyInstance) => {
  const meili = new MeiliSearch({ host: env.MEILISEARCH_URL, apiKey: env.MEILISEARCH_KEY });
  fastify.decorate("meili", meili);
  await configureMeilisearch(meili);
});
