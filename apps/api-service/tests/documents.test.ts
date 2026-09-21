import { describe, it, expect, vi } from "vitest";

import { createRouteCapture, makeReply, makeRequest } from "./helpers.js";

vi.mock("../src/env.js", () => ({ env: { S3_BUCKET: "docysen-dev" } }));

const getPresignedUploadUrl = vi.fn();
const getPresignedDownloadUrl = vi.fn();
vi.mock("@docysen/utils", () => ({
  getPresignedUploadUrl: (...args: unknown[]) => getPresignedUploadUrl(...args),
  getPresignedDownloadUrl: (...args: unknown[]) => getPresignedDownloadUrl(...args),
}));

const documentRoutes = (await import("../src/routes/documents.js")).default;

const validCreateBody = {
  title: "Cours de réseaux",
  subject: "Réseaux",
  docType: "cours",
  promoId: "promo-1",
  semester: "S5",
  fileName: "cours étrange!.pdf",
  mimeType: "application/pdf",
  fileSize: 1000,
};

async function setup(overrides: Record<string, unknown> = {}) {
  const { fastify, handler } = createRouteCapture({
    s3: {},
    thumbnailsQueue: { add: vi.fn() },
    processingQueue: { add: vi.fn() },
    prisma: {
      promo: { findUnique: vi.fn() },
      user: { findUnique: vi.fn() },
      document: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
    },
    ...overrides,
  });
  await documentRoutes(fastify);
  return { fastify, handler };
}

describe("GET /documents", () => {
  it("filtre sur l'uploader pour un étudiant", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const { handler } = await setup({ prisma: { document: { findMany } } });
    const reply = makeReply();
    await handler("GET", "/documents")(
      makeRequest({ user: { userId: "jdupont", role: "student" } }),
      reply,
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { uploadedBy: { aurionId: "jdupont" } } }),
    );
  });

  it("ne filtre pas pour un admin", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const { handler } = await setup({ prisma: { document: { findMany } } });
    const reply = makeReply();
    await handler("GET", "/documents")(
      makeRequest({ user: { userId: "admin1", role: "admin" } }),
      reply,
    );
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });
});

describe("POST /documents", () => {
  it("rejette un body invalide", async () => {
    const { handler } = await setup();
    const reply = makeReply();
    await handler("POST", "/documents")(makeRequest({ body: {} }), reply);
    expect(reply.status).toHaveBeenCalledWith(400);
  });

  it("400 si la promo est inconnue", async () => {
    const promo = { findUnique: vi.fn().mockResolvedValue(null) };
    const { handler } = await setup({ prisma: { promo } });
    const reply = makeReply();
    await handler("POST", "/documents")(
      makeRequest({ body: validCreateBody, user: { userId: "jdupont" } }),
      reply,
    );
    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({ error: "Promo inconnue" });
  });

  it("400 si le semestre est inconnu pour cette promo", async () => {
    const promo = { findUnique: vi.fn().mockResolvedValue({ id: "promo-1", semesters: ["S6"] }) };
    const { handler } = await setup({ prisma: { promo } });
    const reply = makeReply();
    await handler("POST", "/documents")(
      makeRequest({ body: validCreateBody, user: { userId: "jdupont" } }),
      reply,
    );
    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({ error: "Semestre inconnu pour cette promo" });
  });

  it("404 si l'utilisateur est introuvable", async () => {
    const promo = { findUnique: vi.fn().mockResolvedValue({ id: "promo-1", semesters: ["S5"] }) };
    const user = { findUnique: vi.fn().mockResolvedValue(null) };
    const { handler } = await setup({ prisma: { promo, user } });
    const reply = makeReply();
    await handler("POST", "/documents")(
      makeRequest({ body: validCreateBody, user: { userId: "jdupont" } }),
      reply,
    );
    expect(reply.status).toHaveBeenCalledWith(404);
  });

  it("crée le document et retourne une URL présignée", async () => {
    const promo = { findUnique: vi.fn().mockResolvedValue({ id: "promo-1", semesters: ["S5"] }) };
    const user = { findUnique: vi.fn().mockResolvedValue({ id: "user-1" }) };
    const create = vi.fn().mockResolvedValue({ id: "doc-1" });
    getPresignedUploadUrl.mockResolvedValueOnce("https://s3.example/upload?sig=abc");
    const { handler } = await setup({ prisma: { promo, user, document: { create } } });
    const reply = makeReply();
    await handler("POST", "/documents")(
      makeRequest({ body: validCreateBody, user: { userId: "jdupont" } }),
      reply,
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "Cours de réseaux", uploadedById: "user-1" }),
      }),
    );
    const [[createArgs]] = create.mock.calls;
    expect(createArgs.data.s3Key).toMatch(/^documents\/promo-1\/.+-cours__trange_\.pdf$/);
    expect(reply.status).toHaveBeenCalledWith(201);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "doc-1",
        uploadUrl: "https://s3.example/upload?sig=abc",
      }),
    );
  });
});

describe("POST /documents/:id/confirm-upload", () => {
  it("404 si le document est introuvable", async () => {
    const document = { findUnique: vi.fn().mockResolvedValue(null) };
    const { handler } = await setup({ prisma: { document } });
    const reply = makeReply();
    await handler("POST", "/documents/:id/confirm-upload")(
      makeRequest({ params: { id: "doc-1" }, user: { userId: "jdupont" } }),
      reply,
    );
    expect(reply.status).toHaveBeenCalledWith(404);
  });

  it("403 si le requérant n'est pas le déposant", async () => {
    const document = {
      findUnique: vi.fn().mockResolvedValue({ id: "doc-1", uploadedById: "user-1" }),
    };
    const user = { findUnique: vi.fn().mockResolvedValue({ id: "user-2" }) };
    const { handler } = await setup({ prisma: { document, user } });
    const reply = makeReply();
    await handler("POST", "/documents/:id/confirm-upload")(
      makeRequest({ params: { id: "doc-1" }, user: { userId: "jdupont" } }),
      reply,
    );
    expect(reply.status).toHaveBeenCalledWith(403);
  });

  it("enfile les jobs thumbnail + processing pour le déposant", async () => {
    const document = {
      findUnique: vi.fn().mockResolvedValue({
        id: "doc-1",
        uploadedById: "user-1",
        s3Key: "documents/promo-1/x-cours.pdf",
        mimeType: "application/pdf",
        fileName: "cours.pdf",
      }),
    };
    const user = { findUnique: vi.fn().mockResolvedValue({ id: "user-1" }) };
    const thumbnailsQueue = { add: vi.fn() };
    const processingQueue = { add: vi.fn() };
    const { handler } = await setup({
      prisma: { document, user },
      thumbnailsQueue,
      processingQueue,
    });
    const reply = makeReply();
    await handler("POST", "/documents/:id/confirm-upload")(
      makeRequest({ params: { id: "doc-1" }, user: { userId: "jdupont" } }),
      reply,
    );
    expect(thumbnailsQueue.add).toHaveBeenCalled();
    expect(processingQueue.add).toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(202);
  });
});

describe("GET /documents/:id/preview-url", () => {
  it("404 si le document est introuvable", async () => {
    const document = { findUnique: vi.fn().mockResolvedValue(null) };
    const { handler } = await setup({ prisma: { document } });
    const reply = makeReply();
    await handler("GET", "/documents/:id/preview-url")(
      makeRequest({ params: { id: "doc-1" }, user: { userId: "jdupont" } }),
      reply,
    );
    expect(reply.status).toHaveBeenCalledWith(404);
  });

  it("403 si l'étudiant n'est ni le déposant ni un modérateur et le document n'est pas approuvé", async () => {
    const document = {
      findUnique: vi.fn().mockResolvedValue({
        id: "doc-1",
        uploadedById: "user-2",
        status: "pending",
        previewKey: null,
        s3Key: "documents/x.pdf",
        mimeType: "application/pdf",
      }),
    };
    const user = { findUnique: vi.fn().mockResolvedValue({ id: "user-1", role: "student" }) };
    const { handler } = await setup({ prisma: { document, user } });
    const reply = makeReply();
    await handler("GET", "/documents/:id/preview-url")(
      makeRequest({ params: { id: "doc-1" }, user: { userId: "jdupont" } }),
      reply,
    );
    expect(reply.status).toHaveBeenCalledWith(403);
  });

  it("autorise l'accès et préfère previewKey s'il existe", async () => {
    const document = {
      findUnique: vi.fn().mockResolvedValue({
        id: "doc-1",
        uploadedById: "user-2",
        status: "approved",
        previewKey: "previews/doc-1.pdf",
        s3Key: "documents/x.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    };
    const user = { findUnique: vi.fn().mockResolvedValue({ id: "user-1", role: "student" }) };
    getPresignedDownloadUrl.mockResolvedValueOnce("https://s3.example/preview?sig=xyz");
    const { handler } = await setup({ prisma: { document, user } });
    const reply = makeReply();
    await handler("GET", "/documents/:id/preview-url")(
      makeRequest({ params: { id: "doc-1" }, user: { userId: "jdupont" } }),
      reply,
    );
    expect(getPresignedDownloadUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ key: "previews/doc-1.pdf" }),
    );
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://s3.example/preview?sig=xyz",
        previewMimeType: "application/pdf",
      }),
    );
  });
});
