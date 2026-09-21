import { describe, it, expect, vi } from "vitest";

import { createRouteCapture, makeReply, makeRequest } from "./helpers.js";

vi.mock("../src/env.js", () => ({
  env: { JWT_SECRET: "test-secret-at-least-32-characters-long" },
}));

const meRoutes = (await import("../src/routes/me.js")).default;

async function setup(userOverrides: Record<string, unknown> = {}) {
  const { fastify, handler } = createRouteCapture({
    prisma: { user: userOverrides },
  });
  await meRoutes(fastify);
  return handler;
}

describe("GET /users/me", () => {
  it("404 si l'utilisateur est introuvable", async () => {
    const handler = await setup({ findUnique: vi.fn().mockResolvedValue(null) });
    const reply = makeReply();
    await handler("GET", "/users/me")(makeRequest({ user: { userId: "jdupont" } }), reply);
    expect(reply.status).toHaveBeenCalledWith(404);
  });

  it("retourne le profil de l'utilisateur courant", async () => {
    const handler = await setup({
      findUnique: vi.fn().mockResolvedValue({
        aurionId: "jdupont",
        aurionEmail: "jean.dupont@isen-ouest.yncrea.fr",
        firstName: "Jean",
        lastName: "Dupont",
        role: "student",
        notificationEmail: null,
      }),
    });
    const reply = makeReply();
    await handler("GET", "/users/me")(makeRequest({ user: { userId: "jdupont" } }), reply);
    expect(reply.send).toHaveBeenCalledWith({
      userId: "jdupont",
      email: "jean.dupont@isen-ouest.yncrea.fr",
      firstName: "Jean",
      lastName: "Dupont",
      role: "student",
      notificationEmail: null,
    });
  });
});

describe("PATCH /users/me/notification-email", () => {
  it("rejette un body invalide", async () => {
    const handler = await setup({});
    const reply = makeReply();
    await handler("PATCH", "/users/me/notification-email")(
      makeRequest({ body: { optIn: true }, user: { userId: "jdupont" } }),
      reply,
    );
    expect(reply.status).toHaveBeenCalledWith(400);
  });

  it("enregistre l'email choisi quand optIn est true", async () => {
    const update = vi.fn().mockResolvedValue({ notificationEmail: "perso@example.test" });
    const handler = await setup({ update });
    const reply = makeReply();
    await handler("PATCH", "/users/me/notification-email")(
      makeRequest({
        body: { optIn: true, email: "perso@example.test" },
        user: { userId: "jdupont" },
      }),
      reply,
    );
    expect(update).toHaveBeenCalledWith({
      where: { aurionId: "jdupont" },
      data: { notificationEmail: "perso@example.test" },
    });
    expect(reply.send).toHaveBeenCalledWith({ notificationEmail: "perso@example.test" });
  });

  it("efface l'email quand optIn est false", async () => {
    const update = vi.fn().mockResolvedValue({ notificationEmail: null });
    const handler = await setup({ update });
    const reply = makeReply();
    await handler("PATCH", "/users/me/notification-email")(
      makeRequest({ body: { optIn: false }, user: { userId: "jdupont" } }),
      reply,
    );
    expect(update).toHaveBeenCalledWith({
      where: { aurionId: "jdupont" },
      data: { notificationEmail: null },
    });
  });
});
