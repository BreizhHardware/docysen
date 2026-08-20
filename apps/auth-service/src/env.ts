import { z } from "zod";
import { BaseEnvSchema, loadEnv } from "@docysen/config";

export const AuthServiceEnvSchema = BaseEnvSchema.extend({
  JWT_SECRET: z.string().min(32, "JWT_SECRET doit faire au moins 32 caractères"),
  JWT_EXPIRES_IN: z.string().default("1h"),
  DATABASE_URL: z.url(),
  WEBAURION_BASE_URL: z.url().default("https://web.isen-ouest.fr/webAurion"),
  ISEN_EMAIL_DOMAIN: z.string().min(1).default("isen-ouest.yncrea.fr"),
});
export type AuthServiceEnv = z.infer<typeof AuthServiceEnvSchema>;

export const env = loadEnv(AuthServiceEnvSchema);
