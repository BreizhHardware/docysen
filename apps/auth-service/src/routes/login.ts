import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import { LoginBodySchema, type LoginResponse, type JwtPayload } from "@docysen/types";
import { buildIsenEmail, parseAurionName } from "@docysen/utils";
import { loginToWebAurion } from "../webaurion/client.js";
import { WebAurionAuthError, WebAurionUnavailableError } from "../webaurion/errors.js";
import { env } from "../env.js";

export default async function loginRoutes(fastify: FastifyInstance) {
  fastify.post("/auth/login", async (request, reply) => {
    const parseResult = LoginBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply
        .status(400)
        .send({ error: "Requête invalide", issues: parseResult.error.issues });
    }
    const { username, password } = parseResult.data;

    // À partir d'ici, `username`/`password` ne vivent qu'en mémoire le temps de ce handler.
    let rawName: string;
    try {
      const session = await loginToWebAurion(username, password, env.WEBAURION_BASE_URL);
      rawName = session.rawName;
    } catch (err) {
      if (err instanceof WebAurionAuthError) {
        return reply.status(401).send({ error: "Identifiants WebAurion invalides" });
      }
      if (err instanceof WebAurionUnavailableError) {
        return reply.status(502).send({ error: err.message });
      }
      throw err;
    }

    const { firstName, lastName } = parseAurionName(rawName);
    const email = buildIsenEmail(rawName, env.ISEN_EMAIL_DOMAIN);

    const existingUser = await fastify.prisma.user.findUnique({ where: { aurionId: username } });
    const isFirstLogin = !existingUser;

    const user = await fastify.prisma.user.upsert({
      where: { aurionId: username },
      create: { aurionId: username, aurionEmail: email, firstName, lastName },
      // On ne touche pas à `notificationEmail` ici : c'est un choix explicite de l'utilisateur (voir routes/me.ts),
      // pas quelque chose qu'on doit réécrire à chaque connexion.
      update: { aurionEmail: email, firstName, lastName },
    });

    const payload: Omit<JwtPayload, "iat" | "exp"> = {
      userId: user.aurionId,
      email: user.aurionEmail,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };

    const token = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    });

    // `username`/`password` sortent de scope ici : jamais écrits, jamais loggés, jamais renvoyés.
    const responseBody: LoginResponse = {
      token,
      user: {
        userId: user.aurionId,
        email: user.aurionEmail,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isFirstLogin,
        notificationEmail: user.notificationEmail,
      },
    };

    return reply.send(responseBody);
  });
}
