import type { FastifyInstance } from "fastify";
import { CreatePromoSchema, type PromoSummary } from "@docysen/types";
import { requireAuth, requireRole } from "../middleware/auth.js";

export default async function promoRoutes(fastify: FastifyInstance) {
  /** Peuple les selects promo/semestre du formulaire d'upload (voir décisions : saisis manuellement). */
  fastify.get("/promos", { preHandler: requireAuth }, async (_request, reply) => {
    const promos = await fastify.prisma.promo.findMany({ orderBy: { label: "asc" } });
    const body: PromoSummary[] = promos.map((promo) => ({
      id: promo.id,
      label: promo.label,
      semesters: promo.semesters,
    }));
    return reply.send(body);
  });

  /**
   * Création d'une promo. Avancé depuis la phase 9 (CRUD admin complet) pour débloquer l'upload
   * en attendant l'interface d'administration : réservé admin/modérateur dès maintenant.
   */
  fastify.post(
    "/promos",
    { preHandler: [requireAuth, requireRole("admin", "moderator")] },
    async (request, reply) => {
      const parseResult = CreatePromoSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply
          .status(400)
          .send({ error: "Requête invalide", issues: parseResult.error.issues });
      }
      const body = parseResult.data;

      const existing = await fastify.prisma.promo.findUnique({ where: { label: body.label } });
      if (existing) {
        return reply.status(409).send({ error: "Une promo avec ce label existe déjà" });
      }

      const promo = await fastify.prisma.promo.create({
        data: { label: body.label, semesters: body.semesters },
      });

      const responseBody: PromoSummary = {
        id: promo.id,
        label: promo.label,
        semesters: promo.semesters,
      };
      return reply.status(201).send(responseBody);
    },
  );
}
