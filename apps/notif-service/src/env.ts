import { BaseEnvSchema, loadEnv } from "@docysen/config";
import { z } from "zod";

export const NotifServiceEnvSchema = BaseEnvSchema.extend({
  REDIS_URL: z.url().default("redis://localhost:6379"),
  SMTP_HOST: z.string().min(1).default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM: z.string().default("no-reply@isen-ouest.yncrea.fr"),
});

export type NotifServiceEnv = z.infer<typeof NotifServiceEnvSchema>;

export const env = loadEnv(NotifServiceEnvSchema);
