import { z } from "zod";

export const UserRoleSchema = z.enum(["student", "moderator", "admin"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

/** Corps de la requête POST /auth/login, jamais loggé tel quel (voir sanitize middleware). */
export const LoginBodySchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});
export type LoginBody = z.infer<typeof LoginBodySchema>;

/** Payload signé dans le JWT émis par auth-service. */
export const JwtPayloadSchema = z.object({
  userId: z.string(), // login WebAurion
  email: z.string().email(), // email ISEN construit (aurionEmail)
  firstName: z.string(),
  lastName: z.string(),
  role: UserRoleSchema,
  iat: z.number().optional(),
  exp: z.number().optional(),
});
export type JwtPayload = z.infer<typeof JwtPayloadSchema>;

/** Réponse de POST /auth/login. */
export const LoginResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    userId: z.string(),
    email: z.string().email(),
    firstName: z.string(),
    lastName: z.string(),
    role: UserRoleSchema,
    isFirstLogin: z.boolean(),
    notificationEmail: z.string().email().nullable(),
  }),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

/** Corps de PATCH /users/me/notification-email, consentement opt-in pour les notifications. */
export const NotificationEmailChoiceSchema = z.discriminatedUnion("optIn", [
  z.object({ optIn: z.literal(true), email: z.string().email() }),
  z.object({ optIn: z.literal(false) }),
]);
export type NotificationEmailChoice = z.infer<typeof NotificationEmailChoiceSchema>;
