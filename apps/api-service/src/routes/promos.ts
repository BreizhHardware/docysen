import { CreatePromoSchema, UpdatePromoSchema, type PromoSummary } from "@docysen/types";
import type { FastifyInstance } from "fastify";

import { requireAuth, requireRole } from "../middleware/auth.js";

export default async function promoRoutes(fastify: FastifyInstance) {
  /**
   * Peuple les selects promo/semestre du formulaire d'upload (voir décisions : saisis
   * manuellement).
   */
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
   * Création d'une promo. Avancé depuis la phase 9 (CRUD admin complet) pour débloquer l'upload en
   * attendant l'interface d'administration : réservé admin/modérateur dès maintenant.
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

  /** Modification d'une promo (label et/ou semestres). Réservé admin/modérateur. */
  fastify.patch(
    "/promos/:id",
    { preHandler: [requireAuth, requireRole("admin", "moderator")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const parseResult = UpdatePromoSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply
          .status(400)
          .send({ error: "Requête invalide", issues: parseResult.error.issues });
      }
      const body = parseResult.data;

      const promo = await fastify.prisma.promo.findUnique({ where: { id } });
      if (!promo) return reply.status(404).send({ error: "Promo introuvable" });

      if (body.label && body.label !== promo.label) {
        const conflict = await fastify.prisma.promo.findUnique({ where: { label: body.label } });
        if (conflict) return reply.status(409).send({ error: "Ce label est déjà utilisé" });
      }

      const updated = await fastify.prisma.promo.update({
        where: { id },
        data: {
          ...(body.label !== undefined && { label: body.label }),
          ...(body.semesters !== undefined && { semesters: body.semesters }),
        },
      });

      const responseBody: PromoSummary = {
        id: updated.id,
        label: updated.label,
        semesters: updated.semesters,
      };
      return reply.send(responseBody);
    },
  );

  /**
   * Suppression d'une promo (admin uniquement). Refusée si la promo a des documents pour éviter des
   * orphelins.
   */
  fastify.delete(
    "/promos/:id",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const promo = await fastify.prisma.promo.findUnique({
        where: { id },
        include: { _count: { select: { documents: true } } },
      });
      if (!promo) return reply.status(404).send({ error: "Promo introuvable" });

      if (promo._count.documents > 0) {
        return reply.status(409).send({
          error: `Impossible de supprimer : ${promo._count.documents} document(s) lié(s) à cette promo`,
        });
      }

      await fastify.prisma.promo.delete({ where: { id } });
      return reply.status(204).send();
    },
  );
}
