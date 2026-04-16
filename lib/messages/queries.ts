/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server";
import type { PartnershipMessageRow } from "./types";

/**
 * All messages for a relationship (oldest first — UI typically scrolls to bottom).
 */
export async function getMessagesForRelationship(
  relationshipId: string,
  limit = 200,
): Promise<PartnershipMessageRow[]> {
  const supabase = await createClient();
  const { data } = await (supabase as any)
    .from("partnership_messages")
    .select("*")
    .eq("relationship_id", relationshipId)
    .order("created_at", { ascending: true })
    .limit(limit) as { data: PartnershipMessageRow[] | null };
  return data ?? [];
}

/**
 * Count unread messages in a thread for the current user (non-sender, read_at null).
 */
export async function getUnreadCount(relationshipId: string): Promise<number> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count } = await (supabase as any)
    .from("partnership_messages")
    .select("id", { count: "exact", head: true })
    .eq("relationship_id", relationshipId)
    .is("read_at", null)
    .neq("sender_profile", user.id) as { count: number | null };

  return count ?? 0;
}
