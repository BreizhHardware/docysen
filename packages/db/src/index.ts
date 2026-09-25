import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/client/client.js";

export * from "../generated/client/client.js";

let client: PrismaClient | undefined;

/** Instance Prisma partagée : une seule connexion par process */
export function getPrismaClient(): PrismaClient {
  if (!client) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    client = new PrismaClient({ adapter });
  }
  return client;
}
