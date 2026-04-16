export type MessageRole = "restaurant" | "supplier";

export type PartnershipMessageRow = {
  id: string;
  relationship_id: string;
  sender_role: MessageRole;
  sender_profile: string;
  body: string;
  attachments: unknown | null;
  read_at: string | null;
  created_at: string;
};

export type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };
