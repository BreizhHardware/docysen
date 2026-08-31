import { z } from "zod";

export const RejectionEmailSchema = z.object({
  documentId: z.string().uuid(),
  documentTitle: z.string(),
  recipientEmail: z.string().email(),
  recipientName: z.string(),
  reason: z.string(),
});

export type RejectionEmailPayload = z.infer<typeof RejectionEmailSchema>;
