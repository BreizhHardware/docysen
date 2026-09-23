import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const REQUIRED_ENV: Record<string, string> = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  JWT_SECRET: "a".repeat(32),
  AWS_ACCESS_KEY_ID: "access-key",
  AWS_SECRET_ACCESS_KEY: "secret-key",
  S3_BUCKET: "docysen-bucket",
  MEILISEARCH_URL: "http://localhost:7700",
  MEILISEARCH_KEY: "meili-key",
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

    expect(env.DATABASE_URL).toBe(REQUIRED_ENV.DATABASE_URL);
    expect(env.JWT_SECRET).toBe(REQUIRED_ENV.JWT_SECRET);
    expect(env.API_SERVICE_PORT).toBe(3002);
    expect(env.AWS_REGION).toBe("garage");
    expect(env.REDIS_URL).toBe("redis://localhost:6379");
    expect(env.S3_ENDPOINT).toBeUndefined();
  });

  it("respecte les valeurs fournies plutôt que les défauts", async () => {
    setEnv({
      ...REQUIRED_ENV,
      API_SERVICE_PORT: "4000",
      AWS_REGION: "eu-west-3",
      S3_ENDPOINT: "http://localhost:3900",
      REDIS_URL: "redis://redis:6379",
    });

    const { env } = await import("../src/env.js");

    expect(env.API_SERVICE_PORT).toBe(4000);
    expect(env.AWS_REGION).toBe("eu-west-3");
    expect(env.S3_ENDPOINT).toBe("http://localhost:3900");
    expect(env.REDIS_URL).toBe("redis://redis:6379");
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
