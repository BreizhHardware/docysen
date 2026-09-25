import type { FastifyInstance } from "fastify";
import { describe, it, expect, vi } from "vitest";

const disconnect = vi.fn().mockResolvedValue(undefined);
const getPrismaClient = vi.fn().mockReturnValue({ $disconnect: disconnect });
vi.mock("@docysen/db", () => ({
  getPrismaClient: (...args: unknown[]) => getPrismaClient(...args),
}));

const prismaPlugin = (await import("../src/plugins/prisma.js")).default;

describe("prismaPlugin", () => {
  it("décore fastify.prisma et ferme la connexion à l'arrêt", async () => {
    const decorate = vi.fn();
    const hooks: Record<string, () => Promise<void>> = {};
    const addHook = vi.fn((name: string, fn: () => Promise<void>) => {
      hooks[name] = fn;
    });
    const fastify = { decorate, addHook } as unknown as FastifyInstance;

    await prismaPlugin(fastify);

    expect(decorate).toHaveBeenCalledWith("prisma", { $disconnect: disconnect });
    expect(addHook).toHaveBeenCalledWith("onClose", expect.any(Function));

    await hooks.onClose();
    expect(disconnect).toHaveBeenCalled();
  });
});
