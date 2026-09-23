import type { UserRole } from "@docysen/types";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { expect, vi } from "vitest";

type Handler = (request: FastifyRequest, reply: FastifyReply) => unknown;
type RouteOpts = { preHandler?: Handler | Handler[] };

type Route = {
  handler: Handler;
  preHandlers: Handler[];
};

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
 * décorations qu'on leur fournit (prisma, s3, meili, queues...).
 *
 * Capture aussi les `preHandler` (requireAuth/requireRole) passés dans les options de route, pour
 * que les tests de garde d'accès (`preHandlers`/`runPreHandlers`) portent sur la chaîne réellement
 * enregistrée plutôt que sur une supposition — sans ça, retirer ou modifier `requireRole` sur une
 * route ne ferait fail aucun test (le handler seul continue de marcher).
 */
export function createRouteCapture(decorations: Record<string, unknown> = {}) {
  const routes = new Map<string, Route>();
  const register =
    (method: string) =>
    (path: string, optsOrHandler: unknown, maybeHandler?: Handler): void => {
      const hasOpts = maybeHandler !== undefined;
      const handler = (hasOpts ? maybeHandler : optsOrHandler) as Handler;
      const opts = hasOpts ? (optsOrHandler as RouteOpts) : undefined;
      const preHandlers = opts?.preHandler ? ([] as Handler[]).concat(opts.preHandler) : [];
      routes.set(`${method} ${path}`, { handler, preHandlers });
    };

  const fastify = {
    get: register("GET"),
    post: register("POST"),
    patch: register("PATCH"),
    delete: register("DELETE"),
    log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    ...decorations,
  } as unknown as FastifyInstance;

  function findRoute(method: string, path: string): Route {
    const found = routes.get(`${method} ${path}`);
    if (!found) throw new Error(`Route ${method} ${path} non enregistrée`);
    return found;
  }

  return {
    fastify,
    handler(method: string, path: string): Handler {
      return findRoute(method, path).handler;
    },
    /** Les preHandlers (ex: [requireAuth, requireRole("admin")]) enregistrés sur cette route. */
    preHandlers(method: string, path: string): Handler[] {
      return findRoute(method, path).preHandlers;
    },
    /**
     * Exécute la chaîne de preHandlers d'une route dans l'ordre, comme le ferait Fastify, en
     * s'arrêtant dès que l'un d'eux envoie une réponse (status/send) — un preHandler suivant ne
     * doit alors plus s'exécuter.
     */
    async runPreHandlers(
      method: string,
      path: string,
      request: FastifyRequest,
      reply: MockReply,
    ): Promise<void> {
      for (const preHandler of findRoute(method, path).preHandlers) {
        await preHandler(request, reply);
        if (reply.status.mock.calls.length > 0 || reply.send.mock.calls.length > 0) return;
      }
    },
  };
}

const ALL_ROLES: UserRole[] = ["student", "moderator", "admin"];

/**
 * Fait rejouer, pour une route protégée par `[requireAuth, requireRole(...)]`, la vraie chaîne de
 * preHandlers enregistrée (JWT signé + vérifié, pas juste `request.user` injecté à la main) contre
 * chacun des rôles existants, et vérifie qu'exactement `allowedRoles` passe. C'est ce test qui
 * échoue si quelqu'un retire `requireRole` d'une route ou modifie la liste des rôles autorisés — un
 * test qui appelle le handler capturé directement (voir `createRouteCapture`) ne le détecterait
 * pas, puisqu'il ne passe jamais par les preHandlers.
 */
export async function expectRouteRoles(
  route: Pick<ReturnType<typeof createRouteCapture>, "runPreHandlers">,
  method: string,
  path: string,
  jwtSecret: string,
  allowedRoles: UserRole[],
): Promise<void> {
  for (const role of ALL_ROLES) {
    const token = jwt.sign(
      {
        userId: "role-check-user",
        email: "role-check@isen-ouest.yncrea.fr",
        firstName: "Role",
        lastName: "Check",
        role,
      },
      jwtSecret,
    );
    const request = makeRequest({ headers: { authorization: `Bearer ${token}` } });
    const reply = makeReply();
    await route.runPreHandlers(method, path, request, reply);

    if (allowedRoles.includes(role)) {
      expect(
        reply.status,
        `${method} ${path} devrait accepter le rôle "${role}"`,
      ).not.toHaveBeenCalled();
    } else {
      expect(
        reply.status,
        `${method} ${path} devrait rejeter le rôle "${role}"`,
      ).toHaveBeenCalledWith(403);
    }
  }

  const unauthenticated = makeReply();
  await route.runPreHandlers(method, path, makeRequest(), unauthenticated);
  expect(
    unauthenticated.status,
    `${method} ${path} devrait exiger une authentification`,
  ).toHaveBeenCalledWith(401);
}
