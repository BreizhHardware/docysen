import { describe, it, expect, vi } from "vitest";

import { createRouteCapture, makeReply, makeRequest } from "./helpers.js";

vi.mock("../src/env.js", () => ({ env: { S3_BUCKET: "docysen-dev" } }));
vi.mock("@docysen/utils", () => ({
  getPresignedDownloadUrl: vi.fn().mockResolvedValue("https://s3.example/thumb.png"),
}));

const searchRoutes = (await import("../src/routes/search.js")).default;

const document = {
  id: "doc-1",
  title: "Cours",
  subject: "Réseaux",
  docType: "cours",
  promoId: "promo-1",
  promo: { label: "ISEN3" },
  semester: "S5",
  fileName: "cours.pdf",
  mimeType: "application/pdf",
  fileSize: 10,
  status: "approved",
  uploadedById: "user-1",
  uploadedBy: { firstName: "Jean", lastName: "Dupont" },
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  thumbnailKey: null,
};

async function setup(
  overrides: { search?: ReturnType<typeof vi.fn>; findMany?: ReturnType<typeof vi.fn> } = {},
) {
  const search = overrides.search ?? vi.fn().mockResolvedValue({ hits: [], estimatedTotalHits: 0 });
  const index = vi.fn().mockReturnValue({ search });
  const findMany = overrides.findMany ?? vi.fn().mockResolvedValue([]);
  const { fastify, handler } = createRouteCapture({
    s3: {},
    meili: { index },
    prisma: { document: { findMany } },
  });
  await searchRoutes(fastify);
  return { handler, search, findMany };
}

describe("GET /subjects", () => {
  it("retourne les matières distinctes des documents approuvés", async () => {
    const findMany = vi.fn().mockResolvedValue([{ subject: "Réseaux" }, { subject: "Algo" }]);
    const { handler } = await setup({ findMany });
    const reply = makeReply();
    await handler("GET", "/subjects")(makeRequest(), reply);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "approved" } }),
    );
    expect(reply.send).toHaveBeenCalledWith(["Réseaux", "Algo"]);
  });
});

describe("GET /search", () => {
  it("rejette une query invalide", async () => {
    const { handler } = await setup();
    const reply = makeReply();
    await handler("GET", "/search")(makeRequest({ query: { page: "not-a-number" } }), reply);
    expect(reply.status).toHaveBeenCalledWith(400);
  });

  it("construit les filtres Meilisearch à partir des paramètres de recherche", async () => {
    const search = vi.fn().mockResolvedValue({ hits: [{ id: "doc-1" }], estimatedTotalHits: 1 });
    const findMany = vi.fn().mockResolvedValue([document]);
    const { handler } = await setup({ search, findMany });
    const reply = makeReply();
    await handler("GET", "/search")(
      makeRequest({
        query: {
          q: "réseau",
          promo: "promo-1",
          subject: "Réseaux",
          fileType: "pdf",
          page: "0",
          limit: "20",
        },
      }),
      reply,
    );

    expect(search).toHaveBeenCalledWith(
      "réseau",
      expect.objectContaining({
        filter: 'promoId = "promo-1" AND subject = "Réseaux" AND fileType = "pdf"',
        offset: 0,
        limit: 20,
      }),
    );
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 1,
        page: 0,
        limit: 20,
        results: [expect.objectContaining({ id: "doc-1" })],
      }),
    );
  });

  it("échappe les guillemets dans les valeurs de filtre", async () => {
    const search = vi.fn().mockResolvedValue({ hits: [], estimatedTotalHits: 0 });
    const { handler } = await setup({ search });
    const reply = makeReply();
    await handler("GET", "/search")(makeRequest({ query: { subject: 'Info"injection' } }), reply);
    expect(search).toHaveBeenCalledWith(
      "",
      expect.objectContaining({ filter: 'subject = "Info\\"injection"' }),
    );
  });

  it("ignore les documents supprimés entre l'indexation et la requête", async () => {
    const search = vi.fn().mockResolvedValue({ hits: [{ id: "doc-1" }, { id: "doc-missing" }] });
    const findMany = vi.fn().mockResolvedValue([document]);
    const { handler } = await setup({ search, findMany });
    const reply = makeReply();
    await handler("GET", "/search")(makeRequest({ query: {} }), reply);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ results: [expect.objectContaining({ id: "doc-1" })], total: 1 }),
    );
  });
});
