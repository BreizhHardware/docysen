import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const REQUIRED_ENV: Record<string, string> = {
  JWT_SECRET: "a".repeat(32),
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
};

const ORIGINAL_ENV = { ...process.env };

function setEnv(overrides: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("env", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it("charge et valide les variables d'environnement requises, avec les valeurs par défaut", async () => {
    setEnv(REQUIRED_ENV);

    const { env } = await import("../src/env.js");

    expect(env.JWT_SECRET).toBe(REQUIRED_ENV.JWT_SECRET);
    expect(env.DATABASE_URL).toBe(REQUIRED_ENV.DATABASE_URL);
    expect(env.JWT_EXPIRES_IN).toBe("1h");
    expect(env.WEBAURION_BASE_URL).toBe("https://web.isen-ouest.fr/webAurion");
    expect(env.ISEN_EMAIL_DOMAIN).toBe("isen-ouest.yncrea.fr");
  });

  it("respecte les valeurs fournies plutôt que les défauts", async () => {
    setEnv({
      ...REQUIRED_ENV,
      JWT_EXPIRES_IN: "30m",
      WEBAURION_BASE_URL: "https://webaurion.example.fr",
      ISEN_EMAIL_DOMAIN: "example.fr",
    });

    const { env } = await import("../src/env.js");

    expect(env.JWT_EXPIRES_IN).toBe("30m");
    expect(env.WEBAURION_BASE_URL).toBe("https://webaurion.example.fr");
    expect(env.ISEN_EMAIL_DOMAIN).toBe("example.fr");
  });

  it("arrête le process avec un message clair si une variable requise est invalide", async () => {
    setEnv({ ...REQUIRED_ENV, JWT_SECRET: "trop-court" });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await import("../src/env.js");

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("JWT_SECRET"));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("arrête le process si une variable requise est absente", async () => {
    setEnv({ ...REQUIRED_ENV, DATABASE_URL: undefined });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await import("../src/env.js");

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("DATABASE_URL"));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
