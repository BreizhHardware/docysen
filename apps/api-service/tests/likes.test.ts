import { describe, it, expect, vi } from "vitest";

import { createRouteCapture, makeReply, makeRequest } from "./helpers.js";

vi.mock("../src/env.js", () => ({ env: { S3_BUCKET: "docysen-dev" } }));
vi.mock("@docysen/utils", () => ({
  getPresignedDownloadUrl: vi.fn().mockResolvedValue("https://s3.example/thumb.png"),
}));

const likesRoutes = (await import("../src/routes/likes.js")).default;

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

async function setup(prismaOverrides: Record<string, unknown>) {
  const { fastify, handler } = createRouteCapture({ s3: {}, prisma: prismaOverrides });
  await likesRoutes(fastify);
  return handler;
}

describe("GET /likes", () => {
  it("404 si l'utilisateur courant est introuvable", async () => {
    const handler = await setup({ user: { findUnique: vi.fn().mockResolvedValue(null) } });
    const reply = makeReply();
    await handler("GET", "/likes")(makeRequest({ user: { userId: "u1" } }), reply);
    expect(reply.status).toHaveBeenCalledWith(404);
  });

  it("retourne les documents likés et les matières favorites", async () => {
    const handler = await setup({
      user: { findUnique: vi.fn().mockResolvedValue({ id: "user-1" }) },
      like: {
        findMany: vi.fn().mockResolvedValue([{ documentId: "doc-1" }]),
      },
      subjectFavorite: {
        findMany: vi.fn().mockResolvedValue([{ subject: "Réseaux" }]),
      },
      document: { findMany: vi.fn().mockResolvedValue([document]) },
    });
    const reply = makeReply();
    await handler("GET", "/likes")(makeRequest({ user: { userId: "u1" } }), reply);

    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        likedDocumentIds: ["doc-1"],
        favoriteSubjects: ["Réseaux"],
        likedDocuments: [expect.objectContaining({ id: "doc-1" })],
      }),
    );
  });
});

describe("POST /likes/documents/:id", () => {
  it("404 si l'utilisateur est introuvable", async () => {
    const handler = await setup({ user: { findUnique: vi.fn().mockResolvedValue(null) } });
    const reply = makeReply();
    await handler("POST", "/likes/documents/:id")(
      makeRequest({ params: { id: "doc-1" }, user: { userId: "u1" } }),
      reply,
    );
    expect(reply.status).toHaveBeenCalledWith(404);
  });

  it("404 si le document est introuvable", async () => {
    const handler = await setup({
      user: { findUnique: vi.fn().mockResolvedValue({ id: "user-1" }) },
      document: { findUnique: vi.fn().mockResolvedValue(null) },
    });
    const reply = makeReply();
    await handler("POST", "/likes/documents/:id")(
      makeRequest({ params: { id: "doc-1" }, user: { userId: "u1" } }),
      reply,
    );
    expect(reply.status).toHaveBeenCalledWith(404);
  });

  it("crée un like s'il n'existe pas encore", async () => {
    const create = vi.fn().mockResolvedValue({});
    const handler = await setup({
      user: { findUnique: vi.fn().mockResolvedValue({ id: "user-1" }) },
      document: { findUnique: vi.fn().mockResolvedValue({ id: "doc-1" }) },
      like: {
        findUnique: vi.fn().mockResolvedValue(null),
        create,
        count: vi.fn().mockResolvedValue(1),
      },
    });
    const reply = makeReply();
    await handler("POST", "/likes/documents/:id")(
      makeRequest({ params: { id: "doc-1" }, user: { userId: "u1" } }),
      reply,
    );
    expect(create).toHaveBeenCalledWith({ data: { userId: "user-1", documentId: "doc-1" } });
    expect(reply.send).toHaveBeenCalledWith({ liked: true, count: 1 });
  });

  it("supprime le like s'il existe déjà (toggle)", async () => {
    const deleteFn = vi.fn().mockResolvedValue({});
    const handler = await setup({
      user: { findUnique: vi.fn().mockResolvedValue({ id: "user-1" }) },
      document: { findUnique: vi.fn().mockResolvedValue({ id: "doc-1" }) },
      like: {
        findUnique: vi.fn().mockResolvedValue({ userId: "user-1", documentId: "doc-1" }),
        delete: deleteFn,
        count: vi.fn().mockResolvedValue(0),
      },
    });
    const reply = makeReply();
    await handler("POST", "/likes/documents/:id")(
      makeRequest({ params: { id: "doc-1" }, user: { userId: "u1" } }),
      reply,
    );
    expect(deleteFn).toHaveBeenCalled();
    expect(reply.send).toHaveBeenCalledWith({ liked: false, count: 0 });
  });
});

describe("POST /likes/subjects", () => {
  it("rejette une matière vide", async () => {
    const handler = await setup({});
    const reply = makeReply();
    await handler("POST", "/likes/subjects")(
      makeRequest({ body: { subject: "   " }, user: { userId: "u1" } }),
      reply,
    );
    expect(reply.status).toHaveBeenCalledWith(400);
  });

  it("404 si l'utilisateur est introuvable", async () => {
    const handler = await setup({ user: { findUnique: vi.fn().mockResolvedValue(null) } });
    const reply = makeReply();
    await handler("POST", "/likes/subjects")(
      makeRequest({ body: { subject: "Réseaux" }, user: { userId: "u1" } }),
      reply,
    );
    expect(reply.status).toHaveBeenCalledWith(404);
  });

  it("ajoute la matière aux favoris si absente", async () => {
    const create = vi.fn().mockResolvedValue({});
    const handler = await setup({
      user: { findUnique: vi.fn().mockResolvedValue({ id: "user-1" }) },
      subjectFavorite: { findUnique: vi.fn().mockResolvedValue(null), create },
    });
    const reply = makeReply();
    await handler("POST", "/likes/subjects")(
      makeRequest({ body: { subject: "Réseaux" }, user: { userId: "u1" } }),
      reply,
    );
    expect(create).toHaveBeenCalledWith({ data: { userId: "user-1", subject: "Réseaux" } });
    expect(reply.send).toHaveBeenCalledWith({ favorited: true, subject: "Réseaux" });
  });

  it("retire la matière des favoris si déjà présente (toggle)", async () => {
    const deleteFn = vi.fn().mockResolvedValue({});
    const handler = await setup({
      user: { findUnique: vi.fn().mockResolvedValue({ id: "user-1" }) },
      subjectFavorite: {
        findUnique: vi.fn().mockResolvedValue({ userId: "user-1", subject: "Réseaux" }),
        delete: deleteFn,
      },
    });
    const reply = makeReply();
    await handler("POST", "/likes/subjects")(
      makeRequest({ body: { subject: "Réseaux" }, user: { userId: "u1" } }),
      reply,
    );
    expect(deleteFn).toHaveBeenCalled();
    expect(reply.send).toHaveBeenCalledWith({ favorited: false, subject: "Réseaux" });
  });
});
