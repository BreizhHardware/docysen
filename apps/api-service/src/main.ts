import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./env.js";
import prismaPlugin from "./plugins/prisma.js";
import s3Plugin from "./plugins/s3.js";
import meilisearchPlugin from "./plugins/meilisearch.js";
import queuePlugin from "./plugins/queue.js";
import documentRoutes from "./routes/documents.js";
import promoRoutes from "./routes/promos.js";
import moderationRoutes from "./routes/moderation.js";
import searchRoutes from "./routes/search.js";
import likesRoutes from "./routes/likes.js";
import dashboardRoutes from "./routes/dashboard.js";
import adminRoutes from "./routes/admin.js";

const fastify = Fastify({
  logger: {
    level: env.NODE_ENV === "production" ? "info" : "debug",
    redact: {
      paths: ["req.headers.authorization"],
      censor: "[redacted]",
    },
  },
});

await fastify.register(cors, {
  origin: env.NODE_ENV !== "production", // à restreindre à l'origine du frontend en prod
  methods: ["GET", "HEAD", "POST", "PATCH", "DELETE"],
});

await fastify.register(prismaPlugin);
await fastify.register(s3Plugin);
await fastify.register(meilisearchPlugin);
await fastify.register(queuePlugin);
await fastify.register(documentRoutes);
await fastify.register(promoRoutes);
await fastify.register(moderationRoutes);
await fastify.register(searchRoutes);
await fastify.register(likesRoutes);
await fastify.register(dashboardRoutes);
await fastify.register(adminRoutes);

fastify.get("/health", async () => ({ status: "ok" }));

fastify
  .listen({ port: env.API_SERVICE_PORT, host: "0.0.0.0" })
  .then(() => fastify.log.info(`api-service démarré sur le port ${env.API_SERVICE_PORT}`))
  .catch((err) => {
    fastify.log.error(err);
    process.exit(1);
  });
