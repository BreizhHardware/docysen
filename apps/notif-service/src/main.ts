import { RejectionEmailSchema } from "@docysen/types";
import { Worker } from "bullmq";

import { sendRejectionEmail } from "./email.js";
import { env } from "./env.js";

export const NOTIFICATIONS_QUEUE = "notifications";

const worker = new Worker(
  NOTIFICATIONS_QUEUE,
  async (job) => {
    const payload = RejectionEmailSchema.parse(job.data);
    await sendRejectionEmail(payload);
    console.log(
      `[notif-service] Email de rejet envoyé à ${payload.recipientEmail} (doc: ${payload.documentId})`,
    );
  },
  { connection: { url: env.REDIS_URL } },
);

worker.on("failed", (job, err) => {
  console.error(
    `[notif-service] Échec de l'envoi de l'email (jobId: ${job?.id}):`,
    err instanceof Error ? err.message : err,
  );
});

worker.on("ready", () => {
  console.log(`[notif-service] Worker démarré, en écoute sur la queue "${NOTIFICATIONS_QUEUE}"`);
});

process.on("SIGTERM", async () => {
  console.log("[notif-service] Arrêt gracieux...");
  await worker.close();
  process.exit(0);
});
