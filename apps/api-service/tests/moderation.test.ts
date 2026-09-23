import { describe, it, expect, vi } from "vitest";

import { createRouteCapture, expectRouteRoles, makeReply, makeRequest } from "./helpers.js";

const JWT_SECRET = "test-secret-at-least-32-characters-long";
vi.mock("../src/env.js", () => ({
  env: {
    JWT_SECRET,
    S3_BUCKET: "docysen-dev",
    MEILISEARCH_URL: "http://localhost:7700",
    MEILISEARCH_KEY: "k",
  },
}));

const getPresignedDownloadUrl = vi.fn().mockResolvedValue("https://s3.example/thumb.png");
const deleteObject = vi.fn().mockResolvedValue(undefined);
vi.mock("@docysen/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@docysen/utils")>();
  return {
    ...actual,
    getPresignedDownloadUrl: (...args: unknown[]) => getPresignedDownloadUrl(...args),
    deleteObject: (...args: unknown[]) => deleteObject(...args),
  };
});

const moderationRoutes = (await import("../src/routes/moderation.js")).default;

const pendingDocument = {
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
  status: "pending",
  uploadedById: "user-1",
  uploadedBy: { firstName: "Jean", lastName: "Dupont" },
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  thumbnailKey: null,
  s3Key: "documents/doc-1.pdf",
  previewKey: null,
  ocrText: null,
};

function makeIndexMocks() {
  const addDocuments = vi.fn();
  const index = vi.fn().mockReturnValue({ addDocuments });
  return { meili: { index }, addDocuments };
}

async function setup(overrides: Record<string, unknown> = {}) {
  const { meili } = makeIndexMocks();
  const overridePrisma = (overrides.prisma as Record<string, Record<string, unknown>>) ?? {};
  const { fastify, handler } = createRouteCapture({
    s3: {},
    meili,
    taggingQueue: { add: vi.fn() },
    notificationsQueue: { add: vi.fn() },
    ...overrides,
    prisma: {
      document: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        ...overridePrisma.document,
      },
      user: { findUnique: vi.fn(), ...overridePrisma.user },
      documentTag: { findMany: vi.fn().mockResolvedValue([]), ...overridePrisma.documentTag },
      moderationEvent: { create: vi.fn(), findMany: vi.fn(), ...overridePrisma.moderationEvent },
      $transaction: overridePrisma.$transaction ?? vi.fn(),
    },
  });
  await moderationRoutes(fastify);
  return { fastify, handler };
}

describe("protection par rôle", () => {
  // Rejoue la vraie chaîne [requireAuth, requireRole(...)] enregistrée sur chaque route (pas un
  // mock) pour tous les rôles existants : échoue si `requireRole` est retiré ou reconfiguré.
  it.each([
    ["GET", "/moderation/queue", ["admin", "moderator"]],
    ["PATCH", "/moderation/:id/approve", ["admin", "moderator"]],
    ["PATCH", "/moderation/:id/reject", ["admin", "moderator"]],
  ] as const)("%s %s réservé à %j", async (method, path, allowedRoles) => {
    const route = createRouteCapture();
    await moderationRoutes(route.fastify);
    await expectRouteRoles(route, method, path, JWT_SECRET, [...allowedRoles]);
  });

  it("GET /moderation/:id/history exige seulement une authentification (le contrôle d'accès se fait sur le contenu)", async () => {
    const route = createRouteCapture();
    await moderationRoutes(route.fastify);
    await expectRouteRoles(route, "GET", "/moderation/:id/history", JWT_SECRET, [
      "student",
      "moderator",
      "admin",
    ]);
  });
});

describe("GET /moderation/queue", () => {
  it("retourne les documents en attente avec miniature", async () => {
    const findMany = vi.fn().mockResolvedValue([pendingDocument]);
    const { handler } = await setup({ prisma: { document: { findMany } } });
    const reply = makeReply();
    await handler("GET", "/moderation/queue")(makeRequest(), reply);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "pending" } }),
    );
    expect(reply.send).toHaveBeenCalledWith([expect.objectContaining({ id: "doc-1" })]);
  });
});

describe("PATCH /moderation/:id/approve", () => {
  it("404 si le modérateur est introuvable", async () => {
    const { handler } = await setup({
      prisma: { user: { findUnique: vi.fn().mockResolvedValue(null) } },
    });
    const reply = makeReply();
    await handler("PATCH", "/moderation/:id/approve")(
      makeRequest({ params: { id: "doc-1" }, user: { userId: "mod1" } }),
      reply,
    );
    expect(reply.status).toHaveBeenCalledWith(404);
  });

  it("404 si le document est introuvable", async () => {
    const { handler } = await setup({
      prisma: {
        user: { findUnique: vi.fn().mockResolvedValue({ id: "mod-1" }) },
        document: { findUnique: vi.fn().mockResolvedValue(null) },
      },
    });
    const reply = makeReply();
    await handler("PATCH", "/moderation/:id/approve")(
      makeRequest({ params: { id: "doc-1" }, user: { userId: "mod1" } }),
      reply,
    );
    expect(reply.status).toHaveBeenCalledWith(404);
  });

  it("409 si le document a déjà été modéré", async () => {
    const { handler } = await setup({
      prisma: {
        user: { findUnique: vi.fn().mockResolvedValue({ id: "mod-1" }) },
        document: {
          findUnique: vi.fn().mockResolvedValue({ ...pendingDocument, status: "approved" }),
        },
      },
    });
    const reply = makeReply();
    await handler("PATCH", "/moderation/:id/approve")(
      makeRequest({ params: { id: "doc-1" }, user: { userId: "mod1" } }),
      reply,
    );
    expect(reply.status).toHaveBeenCalledWith(409);
  });

  it("approuve, indexe et déclenche le tagging si l'OCR est déjà fait", async () => {
    const approved = { ...pendingDocument, status: "approved", ocrText: "texte extrait" };
    const $transaction = vi.fn().mockResolvedValue([approved, {}]);
    const taggingQueue = { add: vi.fn() };
    const { handler } = await setup({
      taggingQueue,
      prisma: {
        user: { findUnique: vi.fn().mockResolvedValue({ id: "mod-1" }) },
        document: { findUnique: vi.fn().mockResolvedValue(pendingDocument) },
        $transaction,
      },
    });
    const reply = makeReply();
    await handler("PATCH", "/moderation/:id/approve")(
      makeRequest({ params: { id: "doc-1" }, user: { userId: "mod1" } }),
      reply,
    );
    expect($transaction).toHaveBeenCalled();
    expect(taggingQueue.add).toHaveBeenCalledWith(
      "tagging",
      expect.objectContaining({ documentId: "doc-1", ocrText: "texte extrait" }),
    );
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ id: "doc-1", status: "approved" }),
    );
  });

  it("n'enfile pas de tagging si l'OCR n'est pas encore fait", async () => {
    const approved = { ...pendingDocument, status: "approved", ocrText: null };
    const $transaction = vi.fn().mockResolvedValue([approved, {}]);
    const taggingQueue = { add: vi.fn() };
    const { handler } = await setup({
      taggingQueue,
      prisma: {
        user: { findUnique: vi.fn().mockResolvedValue({ id: "mod-1" }) },
        document: { findUnique: vi.fn().mockResolvedValue(pendingDocument) },
        $transaction,
      },
    });
    const reply = makeReply();
    await handler("PATCH", "/moderation/:id/approve")(
      makeRequest({ params: { id: "doc-1" }, user: { userId: "mod1" } }),
      reply,
    );
    expect(taggingQueue.add).not.toHaveBeenCalled();
  });
});

describe("PATCH /moderation/:id/reject", () => {
  it("rejette un body invalide", async () => {
    const { handler } = await setup();
    const reply = makeReply();
    await handler("PATCH", "/moderation/:id/reject")(
      makeRequest({ params: { id: "doc-1" }, body: {}, user: { userId: "mod1" } }),
      reply,
    );
    expect(reply.status).toHaveBeenCalledWith(400);
  });

  it("409 si le document a déjà été modéré", async () => {
    const { handler } = await setup({
      prisma: {
        user: { findUnique: vi.fn().mockResolvedValue({ id: "mod-1" }) },
        document: {
          findUnique: vi.fn().mockResolvedValue({ ...pendingDocument, status: "rejected" }),
        },
      },
    });
    const reply = makeReply();
    await handler("PATCH", "/moderation/:id/reject")(
      makeRequest({
        params: { id: "doc-1" },
        body: { reason: "Hors sujet" },
        user: { userId: "mod1" },
      }),
      reply,
    );
    expect(reply.status).toHaveBeenCalledWith(409);
  });

  it("rejette, nettoie S3 et notifie si l'auteur a opté in", async () => {
    const rejected = {
      ...pendingDocument,
      status: "rejected",
      s3Key: "documents/doc-1.pdf",
      thumbnailKey: "thumbs/doc-1.png",
      previewKey: null,
    };
    const $transaction = vi.fn().mockResolvedValue([rejected, {}]);
    const notificationsQueue = { add: vi.fn() };
    const { handler } = await setup({
      notificationsQueue,
      prisma: {
        user: {
          findUnique: vi.fn().mockResolvedValueOnce({ id: "mod-1" }).mockResolvedValueOnce({
            firstName: "Jean",
            lastName: "Dupont",
            notificationEmail: "jean.dupont@example.test",
          }),
        },
        document: {
          findUnique: vi.fn().mockResolvedValue({
            ...pendingDocument,
            s3Key: "documents/doc-1.pdf",
            thumbnailKey: "thumbs/doc-1.png",
            previewKey: null,
          }),
        },
        $transaction,
      },
    });
    const reply = makeReply();
    await handler("PATCH", "/moderation/:id/reject")(
      makeRequest({
        params: { id: "doc-1" },
        body: { reason: "Hors sujet" },
        user: { userId: "mod1" },
      }),
      reply,
    );

    expect(deleteObject).toHaveBeenCalledWith(expect.anything(), {
      bucket: "docysen-dev",
      key: "documents/doc-1.pdf",
    });
    expect(deleteObject).toHaveBeenCalledWith(expect.anything(), {
      bucket: "docysen-dev",
      key: "thumbs/doc-1.png",
    });
    expect(notificationsQueue.add).toHaveBeenCalledWith(
      "notifications",
      expect.objectContaining({ recipientEmail: "jean.dupont@example.test", reason: "Hors sujet" }),
    );
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ id: "doc-1", status: "rejected" }),
    );
  });

  it("nettoie la miniature écrite par thumbnail-worker après la lecture initiale (race condition)", async () => {
    // Le document lu avant la transaction n'a pas encore de thumbnailKey (thumbnail-worker n'avait
    // pas fini). Entre-temps, le worker termine et écrit thumbnailKey/previewKey de façon
    // concurrente (voir plugins/queue.ts) : la ligne renvoyée par la transaction de rejet, elle,
    // les a déjà. Ce test garantit qu'on nettoie bien à partir de cette valeur fraîche, pas de la
    // lecture périmée d'avant transaction, sans quoi l'objet resterait orphelin sur S3.
    const staleDocument = { ...pendingDocument, s3Key: "documents/doc-1.pdf" };
    const rejected = {
      ...pendingDocument,
      status: "rejected",
      s3Key: "documents/doc-1.pdf",
      thumbnailKey: "thumbs/doc-1-concurrent.png",
      previewKey: "previews/doc-1-concurrent.pdf",
    };
    const $transaction = vi.fn().mockResolvedValue([rejected, {}]);
    const { handler } = await setup({
      prisma: {
        user: {
          findUnique: vi.fn().mockResolvedValueOnce({ id: "mod-1" }).mockResolvedValueOnce({
            firstName: "Jean",
            lastName: "Dupont",
            notificationEmail: null,
          }),
        },
        document: { findUnique: vi.fn().mockResolvedValue(staleDocument) },
        $transaction,
      },
    });
    const reply = makeReply();
    await handler("PATCH", "/moderation/:id/reject")(
      makeRequest({
        params: { id: "doc-1" },
        body: { reason: "Hors sujet" },
        user: { userId: "mod1" },
      }),
      reply,
    );

    expect(deleteObject).toHaveBeenCalledWith(expect.anything(), {
      bucket: "docysen-dev",
      key: "thumbs/doc-1-concurrent.png",
    });
    expect(deleteObject).toHaveBeenCalledWith(expect.anything(), {
      bucket: "docysen-dev",
      key: "previews/doc-1-concurrent.pdf",
    });
  });

  it("ne notifie pas si l'auteur n'a pas d'email de notification", async () => {
    const rejected = { ...pendingDocument, status: "rejected" };
    const $transaction = vi.fn().mockResolvedValue([rejected, {}]);
    const notificationsQueue = { add: vi.fn() };
    const { handler } = await setup({
      notificationsQueue,
      prisma: {
        user: {
          findUnique: vi.fn().mockResolvedValueOnce({ id: "mod-1" }).mockResolvedValueOnce({
            firstName: "Jean",
            lastName: "Dupont",
            notificationEmail: null,
          }),
        },
        document: { findUnique: vi.fn().mockResolvedValue(pendingDocument) },
        $transaction,
      },
    });
    const reply = makeReply();
    await handler("PATCH", "/moderation/:id/reject")(
      makeRequest({
        params: { id: "doc-1" },
        body: { reason: "Hors sujet" },
        user: { userId: "mod1" },
      }),
      reply,
    );
    expect(notificationsQueue.add).not.toHaveBeenCalled();
  });
});

describe("GET /moderation/:id/history", () => {
  it("404 si le requérant est introuvable", async () => {
    const { handler } = await setup({
      prisma: { user: { findUnique: vi.fn().mockResolvedValue(null) } },
    });
    const reply = makeReply();
    await handler("GET", "/moderation/:id/history")(
      makeRequest({ params: { id: "doc-1" }, user: { userId: "u1" } }),
      reply,
    );
    expect(reply.status).toHaveBeenCalledWith(404);
  });

  it("403 si le requérant n'est ni l'auteur ni un modérateur", async () => {
    const { handler } = await setup({
      prisma: {
        user: { findUnique: vi.fn().mockResolvedValue({ id: "user-2", role: "student" }) },
        document: {
          findUnique: vi.fn().mockResolvedValue({ ...pendingDocument, uploadedById: "user-1" }),
        },
      },
    });
    const reply = makeReply();
    await handler("GET", "/moderation/:id/history")(
      makeRequest({ params: { id: "doc-1" }, user: { userId: "u2" } }),
      reply,
    );
    expect(reply.status).toHaveBeenCalledWith(403);
  });

  it("retourne l'historique pour l'auteur du document", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "ev-1",
        documentId: "doc-1",
        moderatorId: "mod-1",
        moderator: { firstName: "Jean", lastName: "Dupont" },
        action: "rejected",
        reason: "Hors sujet",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    ]);
    const { handler } = await setup({
      prisma: {
        user: { findUnique: vi.fn().mockResolvedValue({ id: "user-1", role: "student" }) },
        document: {
          findUnique: vi.fn().mockResolvedValue({ ...pendingDocument, uploadedById: "user-1" }),
        },
        moderationEvent: { findMany },
      },
    });
    const reply = makeReply();
    await handler("GET", "/moderation/:id/history")(
      makeRequest({ params: { id: "doc-1" }, user: { userId: "u1" } }),
      reply,
    );
    expect(reply.send).toHaveBeenCalledWith([
      expect.objectContaining({ id: "ev-1", moderatorName: "Jean Dupont", action: "rejected" }),
    ]);
  });
});
