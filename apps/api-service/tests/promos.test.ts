import { describe, it, expect, vi } from "vitest";

import { createRouteCapture, expectRouteRoles, makeReply, makeRequest } from "./helpers.js";

const JWT_SECRET = "test-secret-at-least-32-characters-long";
vi.mock("../src/env.js", () => ({ env: { JWT_SECRET } }));

const promoRoutes = (await import("../src/routes/promos.js")).default;

async function setup(prismaOverrides: Record<string, unknown>) {
  const { fastify, handler } = createRouteCapture({ prisma: { promo: prismaOverrides } });
  await promoRoutes(fastify);
  return handler;
}

describe("protection par rôle", () => {
  // Rejoue la vraie chaîne [requireAuth, requireRole(...)] enregistrée sur chaque route (pas un
  // mock) pour tous les rôles existants : échoue si `requireRole` est retiré ou reconfiguré.
  it.each([
    ["POST", "/promos", ["admin", "moderator"]],
    ["PATCH", "/promos/:id", ["admin", "moderator"]],
    ["DELETE", "/promos/:id", ["admin"]],
  ] as const)("%s %s réservé à %j", async (method, path, allowedRoles) => {
    const route = createRouteCapture();
    await promoRoutes(route.fastify);
    await expectRouteRoles(route, method, path, JWT_SECRET, [...allowedRoles]);
  });

  it("GET /promos exige seulement une authentification, sans restriction de rôle", async () => {
    const route = createRouteCapture();
    await promoRoutes(route.fastify);
    await expectRouteRoles(route, "GET", "/promos", JWT_SECRET, ["student", "moderator", "admin"]);
  });
});

describe("GET /promos", () => {
  it("liste les promos triées par label", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([{ id: "p1", label: "ISEN3", semesters: ["S5", "S6"] }]);
    const handler = await setup({ findMany });
    const reply = makeReply();
    await handler("GET", "/promos")(makeRequest(), reply);
    expect(reply.send).toHaveBeenCalledWith([
      { id: "p1", label: "ISEN3", semesters: ["S5", "S6"] },
    ]);
  });
});

describe("POST /promos", () => {
  it("rejette un body invalide", async () => {
    const handler = await setup({});
    const reply = makeReply();
    await handler("POST", "/promos")(makeRequest({ body: {} }), reply);
    expect(reply.status).toHaveBeenCalledWith(400);
  });

  it("refuse un label déjà utilisé", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "existing" });
    const handler = await setup({ findUnique });
    const reply = makeReply();
    await handler("POST", "/promos")(
      makeRequest({ body: { label: "ISEN3", semesters: ["S5"] } }),
      reply,
    );
    expect(reply.status).toHaveBeenCalledWith(409);
  });

  it("crée la promo si le label est libre", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockResolvedValue({ id: "p1", label: "ISEN3", semesters: ["S5"] });
    const handler = await setup({ findUnique, create });
    const reply = makeReply();
    await handler("POST", "/promos")(
      makeRequest({ body: { label: "ISEN3", semesters: ["S5"] } }),
      reply,
    );
    expect(create).toHaveBeenCalledWith({ data: { label: "ISEN3", semesters: ["S5"] } });
    expect(reply.status).toHaveBeenCalledWith(201);
    expect(reply.send).toHaveBeenCalledWith({ id: "p1", label: "ISEN3", semesters: ["S5"] });
  });
});

describe("PATCH /promos/:id", () => {
  it("rejette un body invalide", async () => {
    const handler = await setup({});
    const reply = makeReply();
    await handler("PATCH", "/promos/:id")(
      makeRequest({ params: { id: "p1" }, body: { label: "" } }),
      reply,
    );
    expect(reply.status).toHaveBeenCalledWith(400);
  });

  it("404 si la promo n'existe pas", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const handler = await setup({ findUnique });
    const reply = makeReply();
    await handler("PATCH", "/promos/:id")(
      makeRequest({ params: { id: "p1" }, body: { label: "ISEN4" } }),
      reply,
    );
    expect(reply.status).toHaveBeenCalledWith(404);
  });

  it("409 si le nouveau label est déjà pris par une autre promo", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce({ id: "p1", label: "ISEN3" })
      .mockResolvedValueOnce({ id: "p2", label: "ISEN4" });
    const handler = await setup({ findUnique });
    const reply = makeReply();
    await handler("PATCH", "/promos/:id")(
      makeRequest({ params: { id: "p1" }, body: { label: "ISEN4" } }),
      reply,
    );
    expect(reply.status).toHaveBeenCalledWith(409);
  });

  it("met à jour label et semestres", async () => {
    const findUnique = vi.fn().mockResolvedValueOnce({ id: "p1", label: "ISEN3" });
    const update = vi.fn().mockResolvedValue({ id: "p1", label: "ISEN3", semesters: ["S5", "S6"] });
    const handler = await setup({ findUnique, update });
    const reply = makeReply();
    await handler("PATCH", "/promos/:id")(
      makeRequest({ params: { id: "p1" }, body: { semesters: ["S5", "S6"] } }),
      reply,
    );
    expect(update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { semesters: ["S5", "S6"] } });
    expect(reply.send).toHaveBeenCalledWith({ id: "p1", label: "ISEN3", semesters: ["S5", "S6"] });
  });
});

describe("DELETE /promos/:id", () => {
  it("404 si la promo n'existe pas", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const handler = await setup({ findUnique });
    const reply = makeReply();
    await handler("DELETE", "/promos/:id")(makeRequest({ params: { id: "p1" } }), reply);
    expect(reply.status).toHaveBeenCalledWith(404);
  });

  it("409 si des documents sont liés à la promo", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "p1", _count: { documents: 2 } });
    const handler = await setup({ findUnique });
    const reply = makeReply();
    await handler("DELETE", "/promos/:id")(makeRequest({ params: { id: "p1" } }), reply);
    expect(reply.status).toHaveBeenCalledWith(409);
  });

  it("supprime la promo si aucun document n'y est lié", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "p1", _count: { documents: 0 } });
    const deleteFn = vi.fn().mockResolvedValue({});
    const handler = await setup({ findUnique, delete: deleteFn });
    const reply = makeReply();
    await handler("DELETE", "/promos/:id")(makeRequest({ params: { id: "p1" } }), reply);
    expect(deleteFn).toHaveBeenCalledWith({ where: { id: "p1" } });
    expect(reply.status).toHaveBeenCalledWith(204);
  });
});
