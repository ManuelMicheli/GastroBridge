/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type NavSection =
  | "restaurant_messages"
  | "supplier_messages"
  | "supplier_orders";

/**
 * Upsert the "last seen at" timestamp for a sidebar section. Call from the
 * page of that section to suppress the badge on subsequent renders until
 * new items arrive.
 */
export async function markSectionSeen(section: NavSection): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await (supabase as any)
    .from("nav_section_seen")
    .upsert(
      { profile_id: user.id, section, last_seen_at: new Date().toISOString() },
      { onConflict: "profile_id,section" },
    );

  // Next 15 caches parent layouts on client-side nav — force a refresh so the
  // sidebar badge (computed in the layout) picks up the new last_seen_at.
  // `after()` defers the revalidate until after the response is sent,
  // avoiding the "revalidatePath during render" error when called from a
  // server component page.
  after(() => {
    revalidatePath("/", "layout");
  });
}

export async function getSectionSeenAt(section: NavSection): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await (supabase as any)
    .from("nav_section_seen")
    .select("last_seen_at")
    .eq("profile_id", user.id)
    .eq("section", section)
    .maybeSingle() as { data: { last_seen_at: string } | null };

  return data?.last_seen_at ?? null;
}
