import { z } from "zod/v4";

export const MessageAttachmentSchema = z.object({
  name: z.string().min(1).max(200),
  url:  z.string().url(),
  mime: z.string().min(1).max(100).optional(),
  size: z.number().int().nonnegative().optional(),
});
export type MessageAttachment = z.infer<typeof MessageAttachmentSchema>;

export const SendMessageSchema = z.object({
  relationship_id: z.string().uuid(),
  body:            z.string().trim().max(2000).optional().nullable(),
  attachments:     z.array(MessageAttachmentSchema).optional().nullable(),
  /** Optional scope: when set, the message is attached to a single order split
   *  (per-order thread); when null, it belongs to the global pair thread. */
  order_split_id:  z.string().uuid().optional().nullable(),
}).refine(
  (v) => (v.body && v.body.length > 0) || (v.attachments && v.attachments.length > 0),
  { message: "Il messaggio non può essere vuoto" },
);

export type SendMessageInput = z.infer<typeof SendMessageSchema>;
