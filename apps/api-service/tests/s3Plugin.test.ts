import type { FastifyInstance } from "fastify";
import { describe, it, expect, vi } from "vitest";

vi.mock("../src/env.js", () => ({
  env: {
    AWS_REGION: "garage",
    S3_ENDPOINT: "http://localhost:3900",
    AWS_ACCESS_KEY_ID: "x",
    AWS_SECRET_ACCESS_KEY: "y",
  },
}));

const destroy = vi.fn();
const createS3Client = vi.fn().mockReturnValue({ destroy });
vi.mock("@docysen/utils", () => ({
  createS3Client: (...args: unknown[]) => createS3Client(...args),
}));

const s3Plugin = (await import("../src/plugins/s3.js")).default;

describe("s3Plugin", () => {
  it("décore fastify.s3 et libère le client à l'arrêt", async () => {
    const decorate = vi.fn();
    const hooks: Record<string, () => Promise<void>> = {};
    const addHook = vi.fn((name: string, fn: () => Promise<void>) => {
      hooks[name] = fn;
    });
    const fastify = { decorate, addHook } as unknown as FastifyInstance;

    await s3Plugin(fastify);

    expect(createS3Client).toHaveBeenCalledWith({
      region: "garage",
      endpoint: "http://localhost:3900",
      accessKeyId: "x",
      secretAccessKey: "y",
    });
    expect(decorate).toHaveBeenCalledWith("s3", { destroy });

    await hooks.onClose();
    expect(destroy).toHaveBeenCalled();
  });
});
