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

/** Résumé d'un utilisateur, retourné par GET /admin/users. */
export const UserSummarySchema = z.object({
  id: z.string(),
  aurionId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  aurionEmail: z.string().email(),
  role: UserRoleSchema,
  notificationEmail: z.string().email().nullable(),
  documentCount: z.number().int().nonnegative(),
  createdAt: z.string(),
});
export type UserSummary = z.infer<typeof UserSummarySchema>;

/** Corps de PATCH /admin/users/:id/role. */
export const ChangeRoleSchema = z.object({
  role: UserRoleSchema,
});
export type ChangeRoleBody = z.infer<typeof ChangeRoleSchema>;

/** Corps de PATCH /promos/:id. */
export const UpdatePromoSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  semesters: z.array(z.string().min(1).max(20)).min(1).optional(),
});
export type UpdatePromoBody = z.infer<typeof UpdatePromoSchema>;

/** Corps de PATCH /users/me/notification-email, consentement opt-in pour les notifications. */
export const NotificationEmailChoiceSchema = z.discriminatedUnion("optIn", [
  z.object({ optIn: z.literal(true), email: z.string().email() }),
  z.object({ optIn: z.literal(false) }),
]);
export type NotificationEmailChoice = z.infer<typeof NotificationEmailChoiceSchema>;
