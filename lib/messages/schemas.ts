import { z } from "zod/v4";

export const SendMessageSchema = z.object({
  relationship_id: z.string().uuid(),
  body:            z.string().trim().min(1, "Il messaggio non può essere vuoto").max(2000),
  attachments:     z.unknown().nullish(),
});

export type SendMessageInput = z.infer<typeof SendMessageSchema>;
