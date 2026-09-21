import { BaseEnvSchema, loadEnv } from "@docysen/config";
import { z } from "zod";

// auth-service et api-service tournent en parallèle (`pnpm dev` racine), ils ne peuvent pas
// partager la variable `PORT` générique de BaseEnvSchema : chacun a la sienne dans le .env racine.
export const ApiServiceEnvSchema = BaseEnvSchema.extend({
  API_SERVICE_PORT: z.coerce.number().int().positive().default(3002),
  DATABASE_URL: z.url(),
  // Même secret que auth-service : api-service ne fait que vérifier les JWT émis là-bas.
  JWT_SECRET: z.string().min(32, "JWT_SECRET doit faire au moins 32 caractères"),
  AWS_REGION: z.string().min(1).default("garage"),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  // Absent en prod (AWS S3 réel), pointe vers Garage en dev.
  S3_ENDPOINT: z.url().optional(),
  // Réseau interne uniquement (K8s), jamais exposé publiquement
  MEILISEARCH_URL: z.url(),
  MEILISEARCH_KEY: z.string().min(1),
  // File BullMQ "thumbnails" (producteur ici, consommateur côté thumbnail-worker Python).
  REDIS_URL: z.url().default("redis://localhost:6379"),
});
export type ApiServiceEnv = z.infer<typeof ApiServiceEnvSchema>;

export const env = loadEnv(ApiServiceEnvSchema);
