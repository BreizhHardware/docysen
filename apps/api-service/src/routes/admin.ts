import type { FastifyInstance } from "fastify";
import { ChangeRoleSchema, type UserSummary } from "@docysen/types";
import { requireAuth, requireRole } from "../middleware/auth.js";

export default async function adminRoutes(fastify: FastifyInstance) {
  /** Liste tous les utilisateurs avec leur nombre de documents (admin uniquement). */
  fastify.get(
    "/admin/users",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (_request, reply) => {
      const users = await fastify.prisma.user.findMany({
        include: { _count: { select: { documents: true } } },
        orderBy: [{ role: "asc" }, { lastName: "asc" }],
      });

      const body: UserSummary[] = users.map((u) => ({
        id: u.id,
        aurionId: u.aurionId,
        firstName: u.firstName,
        lastName: u.lastName,
        aurionEmail: u.aurionEmail,
        role: u.role,
        notificationEmail: u.notificationEmail,
        documentCount: u._count.documents,
        createdAt: u.createdAt.toISOString(),
      }));

      return reply.send(body);
    },
  );

  /**
   * Promotion ou rétrogradation d'un utilisateur (admin uniquement).
   * Un admin ne peut pas changer son propre rôle pour éviter un lock-out accidentel.
   */
  fastify.patch(
    "/admin/users/:id/role",
    { preHandler: [requireAuth, requireRole("admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const parseResult = ChangeRoleSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: "Rôle invalide", issues: parseResult.error.issues });
      }
      const { role } = parseResult.data;

      const target = await fastify.prisma.user.findUnique({ where: { id } });
      if (!target) return reply.status(404).send({ error: "Utilisateur introuvable" });

      // Garde-fou : on identifie l'admin courant via son aurionId (userId dans le JWT)
      if (target.aurionId === request.user!.userId) {
        return reply.status(403).send({ error: "Un admin ne peut pas changer son propre rôle" });
      }

      const updated = await fastify.prisma.user.update({
        where: { id },
        data: { role },
      });

      return reply.send({
        id: updated.id,
        role: updated.role,
        firstName: updated.firstName,
        lastName: updated.lastName,
      });
    },
  );

  /** Vue d'ensemble admin : documents par statut + stockage total en octets. */
  fastify.get(
    "/admin/overview",
    { preHandler: [requireAuth, requireRole("admin", "moderator")] },
    async (_request, reply) => {
      const [counts, storageAgg] = await Promise.all([
        fastify.prisma.document.groupBy({
          by: ["status"],
          _count: { id: true },
        }),
        fastify.prisma.document.aggregate({ _sum: { fileSize: true } }),
      ]);

      const byStatus: Record<string, number> = { pending: 0, approved: 0, rejected: 0 };
      for (const row of counts) {
        byStatus[row.status] = row._count.id;
      }

      return reply.send({
        byStatus,
        totalStorageBytes: storageAgg._sum.fileSize ?? 0,
      });
    },
  );
}
