import { describe, it, expect, vi } from "vitest";

import { createRouteCapture, makeReply, makeRequest } from "./helpers.js";

vi.mock("../src/env.js", () => ({
  env: {
    JWT_SECRET: "test-secret-at-least-32-characters-long",
    JWT_EXPIRES_IN: "1h",
    ISEN_EMAIL_DOMAIN: "isen-ouest.yncrea.fr",
    WEBAURION_BASE_URL: "https://web.isen-ouest.fr/webAurion",
  },
}));

const loginToWebAurion = vi.fn();
vi.mock("../src/webaurion/client.js", () => ({
  loginToWebAurion: (...args: unknown[]) => loginToWebAurion(...args),
}));

const { WebAurionAuthError, WebAurionUnavailableError } =
  await import("../src/webaurion/errors.js");
const loginRoutes = (await import("../src/routes/login.js")).default;

async function setup(userOverrides: Record<string, unknown> = {}) {
  const { fastify, handler } = createRouteCapture({ prisma: { user: userOverrides } });
  await loginRoutes(fastify);
  return handler;
}

describe("POST /auth/login", () => {
  it("rejette un body invalide", async () => {
    const handler = await setup({});
    const reply = makeReply();
    await handler("POST", "/auth/login")(makeRequest({ body: {} }), reply);
    expect(reply.status).toHaveBeenCalledWith(400);
    expect(loginToWebAurion).not.toHaveBeenCalled();
  });

  it("401 si WebAurion rejette les identifiants", async () => {
    loginToWebAurion.mockRejectedValueOnce(new WebAurionAuthError());
    const handler = await setup({});
    const reply = makeReply();
    await handler("POST", "/auth/login")(
      makeRequest({ body: { username: "jdupont", password: "wrong" } }),
      reply,
    );
    expect(reply.status).toHaveBeenCalledWith(401);
  });

  it("502 si WebAurion est indisponible", async () => {
    loginToWebAurion.mockRejectedValueOnce(new WebAurionUnavailableError());
    const handler = await setup({});
    const reply = makeReply();
    await handler("POST", "/auth/login")(
      makeRequest({ body: { username: "jdupont", password: "secret" } }),
      reply,
    );
    expect(reply.status).toHaveBeenCalledWith(502);
  });

  it("relance les erreurs inattendues", async () => {
    loginToWebAurion.mockRejectedValueOnce(new Error("boom"));
    const handler = await setup({});
    const reply = makeReply();
    await expect(
      handler("POST", "/auth/login")(
        makeRequest({ body: { username: "jdupont", password: "secret" } }),
        reply,
      ),
    ).rejects.toThrow("boom");
  });

  it("connecte un nouvel utilisateur (première connexion) et renvoie un JWT", async () => {
    loginToWebAurion.mockResolvedValueOnce({ rawName: "DUPONT Jean" });
    const findUnique = vi.fn().mockResolvedValue(null);
    const upsert = vi.fn().mockResolvedValue({
      aurionId: "jdupont",
      aurionEmail: "jean.dupont@isen-ouest.yncrea.fr",
      firstName: "Jean",
      lastName: "Dupont",
      role: "student",
      notificationEmail: null,
    });
    const handler = await setup({ findUnique, upsert });
    const reply = makeReply();
    await handler("POST", "/auth/login")(
      makeRequest({ body: { username: "jdupont", password: "secret" } }),
      reply,
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { aurionId: "jdupont" },
        create: expect.objectContaining({ firstName: "Jean", lastName: "DUPONT" }),
      }),
    );
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        token: expect.any(String),
        user: expect.objectContaining({ userId: "jdupont", isFirstLogin: true }),
      }),
    );
  });

  it("connecte un utilisateur existant (isFirstLogin=false)", async () => {
    loginToWebAurion.mockResolvedValueOnce({ rawName: "DUPONT Jean" });
    const findUnique = vi.fn().mockResolvedValue({ aurionId: "jdupont" });
    const upsert = vi.fn().mockResolvedValue({
      aurionId: "jdupont",
      aurionEmail: "jean.dupont@isen-ouest.yncrea.fr",
      firstName: "Jean",
      lastName: "Dupont",
      role: "student",
      notificationEmail: "perso@example.test",
    });
    const handler = await setup({ findUnique, upsert });
    const reply = makeReply();
    await handler("POST", "/auth/login")(
      makeRequest({ body: { username: "jdupont", password: "secret" } }),
      reply,
    );

    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.objectContaining({ isFirstLogin: false }) }),
    );
  });
});
