import { JwtPayloadSchema, type JwtPayload, type UserRole } from "@docysen/types";
import type { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";

import { env } from "../env.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

/** Vérifie le JWT émis par auth-service (`Authorization: Bearer <token>`) et peuple `request.user`. */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Authentification requise" });
  }

  const token = header.slice("Bearer ".length);
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    request.user = JwtPayloadSchema.parse(decoded);
  } catch {
    return reply.status(401).send({ error: "Token invalide ou expiré" });
  }
}

/**
 * À chaîner après `requireAuth`. Gestion des promos anticipée depuis la phase 9 (CRUD admin) : en
 * attendant l'interface d'administration complète, seuls admin/modérateur peuvent créer une promo.
 */
export function requireRole(...roles: UserRole[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    if (!request.user || !roles.includes(request.user.role)) {
      return reply.status(403).send({ error: "Accès réservé" });
    }
  };
}
