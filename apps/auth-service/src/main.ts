import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { env } from "./env.js";
import prismaPlugin from "./plugins/prisma.js";
import loginRoutes from "./routes/login.js";
import meRoutes from "./routes/me.js";

const fastify = Fastify({
  logger: {
    level: env.NODE_ENV === "production" ? "info" : "debug",
    // Ceinture + bretelles en plus de sanitizeForLog : ces chemins ne sont jamais loggés,
    // même en cas d'oubli d'un log manuel ailleurs.
    redact: {
      paths: ["req.body.password", "req.body.username", "req.headers.authorization"],
      censor: "[redacted]",
    },
  },
});

await fastify.register(cors, {
  origin: env.NODE_ENV !== "production", // à restreindre à l'origine du frontend en prod
  // @fastify/cors v11 ne whitelist que GET,HEAD,POST par défaut, PATCH/DELETE doivent être ajoutés explicitement.
  methods: ["GET", "HEAD", "POST", "PATCH", "DELETE"],
});

await fastify.register(rateLimit, {
  global: false, // on l'applique explicitement sur /auth/login pour éviter le brute-force
});

await fastify.register(prismaPlugin);

await fastify.register(async (instance) => {
  await instance.register(rateLimit, { max: 10, timeWindow: "1 minute" });
  await instance.register(loginRoutes);
});
await fastify.register(meRoutes);

fastify.get("/health", async () => ({ status: "ok" }));

fastify
  .listen({ port: env.PORT, host: "0.0.0.0" })
  .then(() => fastify.log.info(`auth-service démarré sur le port ${env.PORT}`))
  .catch((err) => {
    fastify.log.error(err);
    process.exit(1);
  });
