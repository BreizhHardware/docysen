import type { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { JwtPayloadSchema, type JwtPayload } from "@docysen/types";
import { env } from "../env.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

/** Vérifie le JWT dans `Authorization: Bearer <token>` et peuple `request.user`. */
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
