import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { vi } from "vitest";

type Handler = (request: FastifyRequest, reply: FastifyReply) => unknown;

export type MockReply = FastifyReply & {
  status: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
};

export function makeReply(): MockReply {
  const reply = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return reply as unknown as MockReply;
}

export function makeRequest(overrides: Record<string, unknown> = {}): FastifyRequest {
  return { headers: {}, ...overrides } as unknown as FastifyRequest;
}

/**
 * Capture les handlers enregistrés par un plugin de routes fastify (`fastify.get/post/...`) sans
 * démarrer de vrai serveur : les modules de routes n'ont besoin que de `fastify.<verbe>()` et des
 * décorations qu'on leur fournit (prisma...).
 */
export function createRouteCapture(decorations: Record<string, unknown> = {}) {
  const routes = new Map<string, Handler>();
  const register =
    (method: string) =>
    (path: string, optsOrHandler: unknown, maybeHandler?: Handler): void => {
      const handler = (maybeHandler ?? optsOrHandler) as Handler;
      routes.set(`${method} ${path}`, handler);
    };

  const fastify = {
    get: register("GET"),
    post: register("POST"),
    patch: register("PATCH"),
    delete: register("DELETE"),
    log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    ...decorations,
  } as unknown as FastifyInstance;

  return {
    fastify,
    handler(method: string, path: string): Handler {
      const found = routes.get(`${method} ${path}`);
      if (!found) throw new Error(`Route ${method} ${path} non enregistrée`);
      return found;
    },
  };
}
