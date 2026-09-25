import type { FastifyRequest } from "fastify";

const SENSITIVE_KEYS = new Set(["password", "username"]);

/**
 * Retourne une copie du body avec les champs sensibles masqués, pour le logging uniquement. Ne
 * modifie jamais request.body : les credentials restent utilisables par le handler, simplement
 * invisibles dans les logs/erreurs.
 */
export function sanitizeForLog(body: unknown): unknown {
  if (typeof body !== "object" || body === null) return body;
  const clean: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  for (const key of Object.keys(clean)) {
    if (SENSITIVE_KEYS.has(key)) clean[key] = "[redacted]";
  }
  return clean;
}

export function logSafeRequest(request: FastifyRequest) {
  request.log.info({ body: sanitizeForLog(request.body) }, "incoming request");
}
