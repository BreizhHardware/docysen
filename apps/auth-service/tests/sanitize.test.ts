import type { FastifyRequest } from "fastify";
import { describe, it, expect, vi } from "vitest";

import { sanitizeForLog, logSafeRequest } from "../src/middleware/sanitize.js";

describe("sanitizeForLog", () => {
  it("masque le mot de passe et le nom d'utilisateur", () => {
    expect(sanitizeForLog({ username: "jdupont", password: "hunter2" })).toEqual({
      username: "[redacted]",
      password: "[redacted]",
    });
  });

  it("laisse les autres champs intacts", () => {
    expect(sanitizeForLog({ username: "jdupont", password: "hunter2", rememberMe: true })).toEqual({
      username: "[redacted]",
      password: "[redacted]",
      rememberMe: true,
    });
  });

  it("ne modifie pas l'objet original", () => {
    const body = { username: "jdupont", password: "hunter2" };
    sanitizeForLog(body);
    expect(body).toEqual({ username: "jdupont", password: "hunter2" });
  });

  it("retourne la valeur telle quelle si ce n'est pas un objet", () => {
    expect(sanitizeForLog("not an object")).toBe("not an object");
    expect(sanitizeForLog(null)).toBe(null);
    expect(sanitizeForLog(undefined)).toBe(undefined);
  });
});

describe("logSafeRequest", () => {
  it("logue le body avec les champs sensibles masqués", () => {
    const info = vi.fn();
    const request = {
      body: { username: "jdupont", password: "hunter2" },
      log: { info },
    } as unknown as FastifyRequest;

    logSafeRequest(request);

    expect(info).toHaveBeenCalledWith(
      { body: { username: "[redacted]", password: "[redacted]" } },
      "incoming request",
    );
  });
});
