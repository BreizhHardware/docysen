import type { FastifyInstance } from "fastify";

import { requireAuth } from "../middleware/auth.js";

export default async function dashboardRoutes(fastify: FastifyInstance) {
  /** Stats globales pour le tableau de bord : total docs, en attente, approuvés ce mois-ci. */
  fastify.get("/dashboard/stats", { preHandler: requireAuth }, async (_request, reply) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, pending, approvedThisMonth] = await Promise.all([
      fastify.prisma.document.count({ where: { status: "approved" } }),
      fastify.prisma.document.count({ where: { status: "pending" } }),
      fastify.prisma.document.count({
        where: { status: "approved", createdAt: { gte: startOfMonth } },
      }),
    ]);

    return reply.send({ total, pending, approvedThisMonth });
  });
}
