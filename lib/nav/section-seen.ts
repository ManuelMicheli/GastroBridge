/* eslint-disable @typescript-eslint/no-explicit-any */
import { cache } from "react";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-user";

export type NavSection =
  | "restaurant_messages"
  | "supplier_messages"
  | "supplier_orders";

/**
 * Upsert the "last seen at" timestamp for a sidebar section. Call from the
 * page of that section to suppress the badge on subsequent renders until
 * new items arrive.
 *
 * Server module (no "use server" — only called from server components, never
 * dispatched as a client action, so we avoid the action-wrapper overhead).
 */
export async function markSectionSeen(section: NavSection): Promise<void> {
  const user = await getCachedUser();
  if (!user) return;

  const supabase = await createClient();
  await (supabase as any)
    .from("nav_section_seen")
    .upsert(
      { profile_id: user.id, section, last_seen_at: new Date().toISOString() },
      { onConflict: "profile_id,section" },
    );

  // Next 15 caches parent layouts on client-side nav — force a refresh so the
  // sidebar badge (computed in the layout) picks up the new last_seen_at.
  // `after()` defers the revalidate until after the response is sent.
  after(() => {
    revalidatePath("/", "layout");
  });
}

/**
 * Per-request cached read of the "last seen at" for a section. Wrapping with
 * React `cache()` collapses repeated calls within one render to a single
 * Supabase round-trip — the layouts hit this 1–3× while computing badges.
 */
export const getSectionSeenAt = cache(
  async (section: NavSection): Promise<string | null> => {
    const user = await getCachedUser();
    if (!user) return null;

    const supabase = await createClient();
    const { data } = (await (supabase as any)
      .from("nav_section_seen")
      .select("last_seen_at")
      .eq("profile_id", user.id)
      .eq("section", section)
      .maybeSingle()) as { data: { last_seen_at: string } | null };

    return data?.last_seen_at ?? null;
  },
);
