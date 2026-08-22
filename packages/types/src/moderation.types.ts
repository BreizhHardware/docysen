import { z } from "zod";

export const ModerationActionSchema = z.enum(["approved", "rejected"]);
export type ModerationAction = z.infer<typeof ModerationActionSchema>;

/** Corps de PATCH /moderation/:id/reject. Motif obligatoire (10-500 caractères). */
export const RejectDocumentSchema = z.object({
  reason: z.string().min(10).max(500),
});
export type RejectDocumentBody = z.infer<typeof RejectDocumentSchema>;

/** GET /moderation/:id/history. Insert-only côté base, jamais d'update. */
export const ModerationEventSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  moderatorId: z.string(),
  moderatorName: z.string(),
  action: ModerationActionSchema,
  reason: z.string().nullable(),
  createdAt: z.string(),
});
export type ModerationEvent = z.infer<typeof ModerationEventSchema>;
