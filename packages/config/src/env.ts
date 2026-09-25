import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadDotenv } from "dotenv";
import { z } from "zod";

// Le .env vit à la racine du monorepo, pas dans chaque service.
if (process.env.VITEST !== "true") {
  loadDotenv({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env") });
}

/**
 * Champs communs à tous les services Node. Chaque service étend ce schéma avec les variables qui
 * lui sont propres, plutôt que de forcer tous les services à déclarer des variables dont ils n'ont
 * pas besoin (ex: SMTP_* n'a de sens que pour notif-service).
 */
export const BaseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
});

export type BaseEnv = z.infer<typeof BaseEnvSchema>;

/**
 * Valide `process.env` contre un schéma et fait planter le service immédiatement avec un message
 * clair si une variable manque ou est mal formée.
 */
export function loadEnv<T extends z.ZodTypeAny>(
  schema: T,
  source: NodeJS.ProcessEnv = process.env,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    // eslint-disable-next-line no-console
    console.error(
      `Configuration invalide, variables d'environnement manquantes ou invalides:\n${issues}`,
    );
    process.exit(1);
  }
  return result.data;
}
