/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server";
import type { PartnershipMessageRow } from "./types";

/**
 * All messages for a relationship, optionally scoped to a single order split.
 * Oldest first — UI typically scrolls to bottom.
 *
 * When `orderSplitId === undefined` → all messages (any scope).
 * When `orderSplitId === null`      → only global-pair messages (order_split_id IS NULL).
 * When `orderSplitId === <uuid>`    → only messages for that split.
 */
export async function getMessagesForRelationship(
  relationshipId: string,
  orderSplitId?: string | null,
  limit = 500,
): Promise<PartnershipMessageRow[]> {
  const supabase = await createClient();

  let query = (supabase as any)
    .from("partnership_messages")
    .select("*")
    .eq("relationship_id", relationshipId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (orderSplitId !== undefined) {
    query = orderSplitId === null
      ? query.is("order_split_id", null)
      : query.eq("order_split_id", orderSplitId);
  }

  const { data } = await query as { data: PartnershipMessageRow[] | null };
  return data ?? [];
}

/**
 * Count unread messages in a thread for the current user (non-sender, read_at null).
 * Optional `orderSplitId` narrows the count to a specific per-order thread.
 */
export async function getUnreadCount(
  relationshipId: string,
  orderSplitId?: string | null,
): Promise<number> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  let query = (supabase as any)
    .from("partnership_messages")
    .select("id", { count: "exact", head: true })
    .eq("relationship_id", relationshipId)
    .is("read_at", null)
    .neq("sender_profile", user.id);

  if (orderSplitId !== undefined) {
    query = orderSplitId === null
      ? query.is("order_split_id", null)
      : query.eq("order_split_id", orderSplitId);
  }

  const { count } = await query as { count: number | null };
  return count ?? 0;
}

/**
 * Count total unread messages for the current user across all partnerships.
 * When `sinceSeenAt` is provided, only messages created after that moment
 * are counted — used by the sidebar badge to suppress re-showing after the
 * user has already visited the Messaggi section.
 * RLS ensures only messages the user can see are counted.
 */
export async function getTotalUnreadMessagesForCurrentUser(
  sinceSeenAt?: string | null,
): Promise<number> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  let q = (supabase as any)
    .from("partnership_messages")
    .select("id", { count: "exact", head: true })
    .is("read_at", null)
    .neq("sender_profile", user.id);

  if (sinceSeenAt) q = q.gt("created_at", sinceSeenAt);

  const { count } = (await q) as { count: number | null };
  return count ?? 0;
}

export type ConversationSummary = {
  relationshipId: string;
  restaurantId: string;
  supplierId: string;
  restaurantName: string;
  supplierName: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
};

/**
 * List all chat conversations for the current user (aggregated per relationship,
 * global thread scope). For restaurants: one entry per connected supplier;
 * for suppliers: one entry per connected restaurant.
 */
export async function listConversationsForCurrentUser(): Promise<ConversationSummary[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  type RelRow = {
    id: string;
    status: string;
    restaurant_id: string;
    supplier_id: string;
    restaurants: { id: string; name: string } | null;
    suppliers:   { id: string; company_name: string } | null;
  };

  // Find relationships the user participates in (any side).
  const { data: rels } = (await (supabase as any)
    .from("restaurant_suppliers")
    .select(
      `id, status, restaurant_id, supplier_id,
       restaurants:restaurant_id ( id, name ),
       suppliers:supplier_id ( id, company_name )`,
    )
    .in("status", ["active", "paused", "pending"])) as { data: RelRow[] | null };

  const list = rels ?? [];
  if (list.length === 0) return [];

  const relIds = list.map((r) => r.id);

  type LastMsg = { id: string; relationship_id: string; body: string | null; created_at: string; order_split_id: string | null };
  // Last message per relationship (global scope only — order_split_id IS NULL).
  const { data: lastMsgs } = (await (supabase as any)
    .from("partnership_messages")
    .select("id, relationship_id, body, created_at, order_split_id")
    .in("relationship_id", relIds)
    .is("order_split_id", null)
    .order("created_at", { ascending: false })
    .limit(1000)) as { data: LastMsg[] | null };

  const lastByRel = new Map<string, { at: string; body: string | null }>();
  for (const m of lastMsgs ?? []) {
    if (!lastByRel.has(m.relationship_id)) {
      lastByRel.set(m.relationship_id, { at: m.created_at, body: m.body });
    }
  }

  // Unread count per relationship.
  const { data: unread } = (await (supabase as any)
    .from("partnership_messages")
    .select("relationship_id")
    .in("relationship_id", relIds)
    .is("order_split_id", null)
    .is("read_at", null)
    .neq("sender_profile", user.id)) as { data: { relationship_id: string }[] | null };

  const unreadByRel = new Map<string, number>();
  for (const u of unread ?? []) {
    unreadByRel.set(u.relationship_id, (unreadByRel.get(u.relationship_id) ?? 0) + 1);
  }

  const summaries: ConversationSummary[] = list.map((r: RelRow) => ({
    relationshipId:    r.id,
    restaurantId:      r.restaurant_id,
    supplierId:        r.supplier_id,
    restaurantName:    r.restaurants?.name ?? "Ristorante",
    supplierName:      r.suppliers?.company_name ?? "Fornitore",
    lastMessageAt:     lastByRel.get(r.id)?.at ?? null,
    lastMessagePreview: lastByRel.get(r.id)?.body ?? null,
    unreadCount:       unreadByRel.get(r.id) ?? 0,
  }));

  // Sort by last message desc, unread-first secondary.
  summaries.sort((a, b) => {
    if (a.lastMessageAt && b.lastMessageAt) return b.lastMessageAt.localeCompare(a.lastMessageAt);
    if (a.lastMessageAt) return -1;
    if (b.lastMessageAt) return 1;
    return a.supplierName.localeCompare(b.supplierName);
  });

  return summaries;
}
