import { getPrismaClient, type PrismaClient } from "@docysen/db";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const prisma = getPrismaClient();
  fastify.decorate("prisma", prisma);
  fastify.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
});
