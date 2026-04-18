/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SendMessageSchema, type SendMessageInput } from "./schemas";
import type { MessageRole, PartnershipMessageRow, Result } from "./types";

/**
 * Detect sender role by checking if the current user owns the restaurant or supplier
 * of the given relationship. Returns null if user is not part of the relationship.
 */
async function detectSenderRole(relationshipId: string): Promise<MessageRole | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rel } = await (supabase as any)
    .from("restaurant_suppliers")
    .select("restaurant_id, supplier_id")
    .eq("id", relationshipId)
    .maybeSingle() as { data: { restaurant_id: string; supplier_id: string } | null };
  if (!rel) return null;

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id")
    .eq("id", rel.restaurant_id)
    .eq("profile_id", user.id)
    .maybeSingle<{ id: string }>();
  if (restaurant) return "restaurant";

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("id", rel.supplier_id)
    .eq("profile_id", user.id)
    .maybeSingle<{ id: string }>();
  if (supplier) return "supplier";

  return null;
}

export async function sendMessage(input: SendMessageInput): Promise<Result<PartnershipMessageRow>> {
  const parsed = SendMessageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Messaggio non valido" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Utente non autenticato" };

  const role = await detectSenderRole(parsed.data.relationship_id);
  if (!role) return { ok: false, error: "Non fai parte di questa relazione" };

  const { data, error } = await (supabase as any)
    .from("partnership_messages")
    .insert({
      relationship_id: parsed.data.relationship_id,
      sender_role:     role,
      sender_profile:  user.id,
      body:            parsed.data.body ?? null,
      attachments:     parsed.data.attachments && parsed.data.attachments.length > 0
                         ? parsed.data.attachments
                         : null,
      order_split_id:  parsed.data.order_split_id ?? null,
    })
    .select("*")
    .single() as { data: PartnershipMessageRow | null; error: { message: string } | null };

  if (error || !data) return { ok: false, error: error?.message ?? "Errore invio messaggio" };

  revalidatePath(`/messaggi`);
  revalidatePath(`/supplier/messaggi`);
  revalidatePath(`/fornitori`);
  revalidatePath(`/supplier/clienti`);
  return { ok: true, data };
}

/**
 * Mark all messages in a thread as read for the current recipient.
 * RLS + trigger ensure only the non-sender can do it.
 * If `orderSplitId` is provided, only messages scoped to that split are marked.
 */
export async function markThreadRead(
  relationshipId: string,
  orderSplitId?: string | null,
): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Utente non autenticato" };

  let query = (supabase as any)
    .from("partnership_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("relationship_id", relationshipId)
    .is("read_at", null)
    .neq("sender_profile", user.id);

  if (orderSplitId !== undefined) {
    query = orderSplitId === null
      ? query.is("order_split_id", null)
      : query.eq("order_split_id", orderSplitId);
  }

  const { error } = await query;

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}
