import { describe, it, expect, vi } from "vitest";

import { createRouteCapture, makeReply, makeRequest } from "./helpers.js";

vi.mock("../src/env.js", () => ({ env: {} }));

const adminRoutes = (await import("../src/routes/admin.js")).default;

describe("GET /admin/users", () => {
  it("liste les utilisateurs avec leur nombre de documents", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "u1",
        aurionId: "jdupont",
        firstName: "Jean",
        lastName: "Dupont",
        aurionEmail: "jean.dupont@isen-ouest.yncrea.fr",
        role: "student",
        notificationEmail: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        _count: { documents: 3 },
      },
    ]);
    const { fastify, handler } = createRouteCapture({ prisma: { user: { findMany } } });
    await adminRoutes(fastify);

    const reply = makeReply();
    await handler("GET", "/admin/users")(makeRequest(), reply);

    expect(reply.send).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "u1",
        documentCount: 3,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    ]);
  });
});

describe("PATCH /admin/users/:id/role", () => {
  async function setup() {
    const findUnique = vi.fn();
    const update = vi.fn();
    const { fastify, handler } = createRouteCapture({
      prisma: { user: { findUnique, update } },
    });
    await adminRoutes(fastify);
    return { fastify, handler, findUnique, update };
  }

  it("rejette un rôle invalide", async () => {
    const { handler, findUnique } = await setup();
    const request = makeRequest({
      params: { id: "u2" },
      body: { role: "superadmin" },
      user: { userId: "admin1", role: "admin" },
    });
    const reply = makeReply();
    await handler("PATCH", "/admin/users/:id/role")(request, reply);
    expect(reply.status).toHaveBeenCalledWith(400);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("404 si l'utilisateur cible n'existe pas", async () => {
    const { handler, findUnique } = await setup();
    findUnique.mockResolvedValue(null);
    const request = makeRequest({
      params: { id: "u2" },
      body: { role: "moderator" },
      user: { userId: "admin1", role: "admin" },
    });
    const reply = makeReply();
    await handler("PATCH", "/admin/users/:id/role")(request, reply);
    expect(reply.status).toHaveBeenCalledWith(404);
  });

  it("interdit à un admin de changer son propre rôle", async () => {
    const { handler, findUnique } = await setup();
    findUnique.mockResolvedValue({ id: "u2", aurionId: "admin1" });
    const request = makeRequest({
      params: { id: "u2" },
      body: { role: "student" },
      user: { userId: "admin1", role: "admin" },
    });
    const reply = makeReply();
    await handler("PATCH", "/admin/users/:id/role")(request, reply);
    expect(reply.status).toHaveBeenCalledWith(403);
  });

  it("met à jour le rôle d'un autre utilisateur", async () => {
    const { handler, findUnique, update } = await setup();
    findUnique.mockResolvedValue({ id: "u2", aurionId: "jdupont" });
    update.mockResolvedValue({
      id: "u2",
      role: "moderator",
      firstName: "Jean",
      lastName: "Dupont",
    });
    const request = makeRequest({
      params: { id: "u2" },
      body: { role: "moderator" },
      user: { userId: "admin1", role: "admin" },
    });
    const reply = makeReply();
    await handler("PATCH", "/admin/users/:id/role")(request, reply);
    expect(update).toHaveBeenCalledWith({ where: { id: "u2" }, data: { role: "moderator" } });
    expect(reply.send).toHaveBeenCalledWith({
      id: "u2",
      role: "moderator",
      firstName: "Jean",
      lastName: "Dupont",
    });
  });
});

describe("GET /admin/overview", () => {
  it("agrège les compteurs par statut et le stockage total", async () => {
    const groupBy = vi.fn().mockResolvedValue([
      { status: "pending", _count: { id: 2 } },
      { status: "approved", _count: { id: 10 } },
    ]);
    const aggregate = vi.fn().mockResolvedValue({ _sum: { fileSize: 123456 } });
    const { fastify, handler } = createRouteCapture({
      prisma: { document: { groupBy, aggregate } },
    });
    await adminRoutes(fastify);

    const reply = makeReply();
    await handler("GET", "/admin/overview")(makeRequest(), reply);

    expect(reply.send).toHaveBeenCalledWith({
      byStatus: { pending: 2, approved: 10, rejected: 0 },
      totalStorageBytes: 123456,
    });
  });

  it("retombe sur 0 octet si aucun document", async () => {
    const groupBy = vi.fn().mockResolvedValue([]);
    const aggregate = vi.fn().mockResolvedValue({ _sum: { fileSize: null } });
    const { fastify, handler } = createRouteCapture({
      prisma: { document: { groupBy, aggregate } },
    });
    await adminRoutes(fastify);

    const reply = makeReply();
    await handler("GET", "/admin/overview")(makeRequest(), reply);
    expect(reply.send).toHaveBeenCalledWith({
      byStatus: { pending: 0, approved: 0, rejected: 0 },
      totalStorageBytes: 0,
    });
  });
});
