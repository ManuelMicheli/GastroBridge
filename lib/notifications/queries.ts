/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createClient } from "@/lib/supabase/server";
import type { InAppNotification } from "@/lib/realtime/supplier-provider";

/**
 * Fetch the N most recent in-app notifications for the current user, used to
 * seed the SupplierRealtimeProvider on first render. RLS restricts rows to
 * recipient_profile_id = auth.uid().
 */
export async function getRecentInAppNotifications(
  limit = 20,
): Promise<InAppNotification[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("in_app_notifications")
      .select("id, event_type, title, body, link, metadata, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return [];
    const rows = (data ?? []) as Array<{
      id: string;
      event_type: string;
      title: string;
      body: string | null;
      link: string | null;
      metadata: Record<string, unknown> | null;
      read_at: string | null;
      created_at: string;
    }>;
    return rows.map((r) => ({
      id: r.id,
      eventType: r.event_type,
      title: r.title,
      body: r.body,
      link: r.link,
      metadata: r.metadata,
      readAt: r.read_at,
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}
