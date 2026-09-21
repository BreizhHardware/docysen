import type { FastifyInstance } from "fastify";
import { describe, it, expect, vi } from "vitest";

vi.mock("../src/env.js", () => ({
  env: { MEILISEARCH_URL: "http://localhost:7700", MEILISEARCH_KEY: "test-key" },
}));

const { indexDocument, removeFromIndex } = await import("../src/lib/search.js");
const { DOCUMENTS_INDEX } = await import("../src/plugins/meilisearch.js");

const document = {
  id: "doc-1",
  title: "Cours de réseaux",
  subject: "Réseaux",
  docType: "cours",
  promoId: "promo-1",
  promo: { label: "ISEN3" },
  semester: "S5",
  fileName: "cours.pdf",
  mimeType: "application/pdf",
  ocrText: "a".repeat(2500),
  createdAt: new Date("2026-01-15T10:00:00.000Z"),
};

function makeFastify(documentTags: { tag: { label: string } }[]) {
  const addDocuments = vi.fn();
  const deleteDocument = vi.fn();
  const index = vi.fn().mockReturnValue({ addDocuments, deleteDocument });
  const fastify = {
    prisma: {
      documentTag: { findMany: vi.fn().mockResolvedValue(documentTags) },
    },
    meili: { index },
  } as unknown as FastifyInstance;
  return { fastify, addDocuments, deleteDocument, index };
}

describe("indexDocument", () => {
  it("indexe le document avec ses tags et un extrait OCR tronqué", async () => {
    const { fastify, addDocuments, index } = makeFastify([
      { tag: { label: "algo" } },
      { tag: { label: "td" } },
    ]);

    await indexDocument(fastify, document as never);

    expect(index).toHaveBeenCalledWith(DOCUMENTS_INDEX);
    expect(addDocuments).toHaveBeenCalledTimes(1);
    const [payload] = addDocuments.mock.calls[0][0];
    expect(payload).toMatchObject({
      id: "doc-1",
      title: "Cours de réseaux",
      promoLabel: "ISEN3",
      fileType: "pdf",
      tags: ["algo", "td"],
    });
    expect(payload.ocrExcerpt).toHaveLength(2000);
    expect(payload.createdAt).toBe(document.createdAt.getTime());
  });

  it("indexe une chaîne vide quand ocrText est absent", async () => {
    const { fastify, addDocuments } = makeFastify([]);
    await indexDocument(fastify, { ...document, ocrText: null } as never);
    const [payload] = addDocuments.mock.calls[0][0];
    expect(payload.ocrExcerpt).toBe("");
    expect(payload.tags).toEqual([]);
  });
});

describe("removeFromIndex", () => {
  it("supprime le document de l'index par id", async () => {
    const { fastify, deleteDocument, index } = makeFastify([]);
    await removeFromIndex(fastify, "doc-1");
    expect(index).toHaveBeenCalledWith(DOCUMENTS_INDEX);
    expect(deleteDocument).toHaveBeenCalledWith("doc-1");
  });
});
