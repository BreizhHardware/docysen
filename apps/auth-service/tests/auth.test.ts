import type { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { describe, it, expect, vi } from "vitest";

const JWT_SECRET = "test-secret-at-least-32-characters-long";

vi.mock("../src/env.js", () => ({
  env: { JWT_SECRET },
}));

const { requireAuth } = await import("../src/middleware/auth.js");

const validPayload = {
  userId: "12345",
  email: "jean.dupont@isen-ouest.yncrea.fr",
  firstName: "Jean",
  lastName: "Dupont",
  role: "student" as const,
};

function makeReply() {
  const reply = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return reply as unknown as FastifyReply & {
    status: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
  };
}

function makeRequest(headers: Record<string, string> = {}) {
  return { headers, user: undefined } as unknown as FastifyRequest;
}

describe("requireAuth", () => {
  it("rejette une requête sans header Authorization", async () => {
    const request = makeRequest();
    const reply = makeReply();
    await requireAuth(request, reply);
    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: "Authentification requise" });
  });

  it("rejette un header qui ne commence pas par 'Bearer '", async () => {
    const request = makeRequest({ authorization: "Basic abc123" });
    const reply = makeReply();
    await requireAuth(request, reply);
    expect(reply.status).toHaveBeenCalledWith(401);
  });

  it("rejette un token signé avec un mauvais secret", async () => {
    const token = jwt.sign(validPayload, "wrong-secret");
    const request = makeRequest({ authorization: `Bearer ${token}` });
    const reply = makeReply();
    await requireAuth(request, reply);
    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: "Token invalide ou expiré" });
    expect(request.user).toBeUndefined();
  });

  it("rejette un token expiré", async () => {
    const token = jwt.sign(validPayload, JWT_SECRET, { expiresIn: -10 });
    const request = makeRequest({ authorization: `Bearer ${token}` });
    const reply = makeReply();
    await requireAuth(request, reply);
    expect(reply.status).toHaveBeenCalledWith(401);
  });

  it("rejette un payload qui ne respecte pas JwtPayloadSchema", async () => {
    const token = jwt.sign({ foo: "bar" }, JWT_SECRET);
    const request = makeRequest({ authorization: `Bearer ${token}` });
    const reply = makeReply();
    await requireAuth(request, reply);
    expect(reply.status).toHaveBeenCalledWith(401);
  });

  it("peuple request.user avec un token valide", async () => {
    const token = jwt.sign(validPayload, JWT_SECRET);
    const request = makeRequest({ authorization: `Bearer ${token}` });
    const reply = makeReply();
    await requireAuth(request, reply);
    expect(reply.status).not.toHaveBeenCalled();
    expect(request.user).toMatchObject(validPayload);
  });
});
