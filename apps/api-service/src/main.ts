import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./env.js";
import prismaPlugin from "./plugins/prisma.js";
import s3Plugin from "./plugins/s3.js";
import documentRoutes from "./routes/documents.js";
import promoRoutes from "./routes/promos.js";

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
await fastify.register(documentRoutes);
await fastify.register(promoRoutes);

fastify.get("/health", async () => ({ status: "ok" }));

fastify
  .listen({ port: env.API_SERVICE_PORT, host: "0.0.0.0" })
  .then(() => fastify.log.info(`api-service démarré sur le port ${env.API_SERVICE_PORT}`))
  .catch((err) => {
    fastify.log.error(err);
    process.exit(1);
  });
