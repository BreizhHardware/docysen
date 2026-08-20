import type { FastifyInstance } from "fastify";
import { NotificationEmailChoiceSchema } from "@docysen/types";
import { requireAuth } from "../middleware/auth.js";

export default async function meRoutes(fastify: FastifyInstance) {
  fastify.get("/users/me", { preHandler: requireAuth }, async (request, reply) => {
    const user = await fastify.prisma.user.findUnique({
      where: { aurionId: request.user!.userId },
    });
    if (!user) return reply.status(404).send({ error: "Utilisateur introuvable" });

    return reply.send({
      userId: user.aurionId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      notificationEmail: user.notificationEmail,
    });
  });

  /**
   * Consentement opt-in pour l'email de notification (rejet de document, etc.).
   * optIn: true  → enregistre l'adresse fournie par l'utilisateur (pas forcément l'email ISEN construit)
   * optIn: false → efface toute adresse enregistrée, aucune notification ne sera envoyée
   */
  fastify.patch(
    "/users/me/notification-email",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parseResult = NotificationEmailChoiceSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply
          .status(400)
          .send({ error: "Requête invalide", issues: parseResult.error.issues });
      }
      const choice = parseResult.data;

      const user = await fastify.prisma.user.update({
        where: { aurionId: request.user!.userId },
        data: { notificationEmail: choice.optIn ? choice.email : null },
      });

      return reply.send({ notificationEmail: user.notificationEmail });
    },
  );
}
