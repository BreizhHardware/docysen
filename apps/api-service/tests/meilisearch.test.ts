import type { FastifyInstance } from "fastify";
import { describe, it, expect, vi } from "vitest";

vi.mock("../src/env.js", () => ({
  env: { MEILISEARCH_URL: "http://localhost:7700", MEILISEARCH_KEY: "test-key" },
}));

const meiliInstance = {
  index: vi.fn().mockReturnValue({
    updateSearchableAttributes: vi.fn().mockResolvedValue(undefined),
    updateFilterableAttributes: vi.fn().mockResolvedValue(undefined),
    updateSortableAttributes: vi.fn().mockResolvedValue(undefined),
  }),
  createIndex: vi.fn().mockResolvedValue({}),
};
const MeiliSearch = vi.fn().mockImplementation(function MeiliSearch() {
  return meiliInstance;
});
vi.mock("meilisearch", () => ({ MeiliSearch }));

const meilisearchPlugin = (await import("../src/plugins/meilisearch.js")).default;
const { configureMeilisearch, DOCUMENTS_INDEX } = await import("../src/plugins/meilisearch.js");

function makeMeili(createIndexImpl: () => Promise<unknown> = () => Promise.resolve({})) {
  const updateSearchableAttributes = vi.fn().mockResolvedValue(undefined);
  const updateFilterableAttributes = vi.fn().mockResolvedValue(undefined);
  const updateSortableAttributes = vi.fn().mockResolvedValue(undefined);
  const index = vi.fn().mockReturnValue({
    updateSearchableAttributes,
    updateFilterableAttributes,
    updateSortableAttributes,
  });
  const createIndex = vi.fn().mockImplementation(createIndexImpl);
  return {
    meili: { index, createIndex } as never,
    index,
    createIndex,
    updateSearchableAttributes,
    updateFilterableAttributes,
    updateSortableAttributes,
  };
}

describe("configureMeilisearch", () => {
  it("crée l'index et configure les attributs de recherche", async () => {
    const mocks = makeMeili();
    await configureMeilisearch(mocks.meili);
    expect(mocks.createIndex).toHaveBeenCalledWith(DOCUMENTS_INDEX, { primaryKey: "id" });
    expect(mocks.updateSearchableAttributes).toHaveBeenCalledWith([
      "title",
      "subject",
      "tags",
      "fileName",
      "ocrExcerpt",
    ]);
    expect(mocks.updateFilterableAttributes).toHaveBeenCalledWith([
      "promoId",
      "subject",
      "fileType",
      "tags",
    ]);
    expect(mocks.updateSortableAttributes).toHaveBeenCalledWith(["createdAt"]);
  });

  it("ignore l'échec de création si l'index existe déjà", async () => {
    const mocks = makeMeili(() => Promise.reject(new Error("index already exists")));
    await expect(configureMeilisearch(mocks.meili)).resolves.toBeUndefined();
    expect(mocks.updateSearchableAttributes).toHaveBeenCalled();
  });
});

describe("meilisearchPlugin (default export)", () => {
  it("crée le client, décore fastify.meili et configure l'index", async () => {
    const decorate = vi.fn();
    const fastify = { decorate } as unknown as FastifyInstance;

    await meilisearchPlugin(fastify);

    expect(MeiliSearch).toHaveBeenCalledWith({
      host: "http://localhost:7700",
      apiKey: "test-key",
    });
    expect(decorate).toHaveBeenCalledWith("meili", meiliInstance);
    expect(meiliInstance.createIndex).toHaveBeenCalledWith(DOCUMENTS_INDEX, { primaryKey: "id" });
  });
});
