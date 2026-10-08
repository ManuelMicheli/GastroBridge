/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Restaurant-side fan-out on the existing notification infra: one in-app row
 * per recipient (realtime toast + bell via RestaurantRealtimeProvider) and a
 * web push to each of their push_subscriptions.
 *
 * The supplier dispatcher (./dispatcher.ts) resolves recipients from
 * supplier_members; this helper resolves them from the restaurant team: the
 * owner (restaurants.profile_id) plus active, accepted restaurant_members whose
 * role grants `permission` (lib/restaurants/permissions.ts).
 *
 * Server-only, service role. Callers MUST authorize upstream. Never throws.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { RESTAURANT_ROLE_MATRIX } from "@/lib/restaurants/permissions";
import type { RestaurantPermission, RestaurantRole } from "@/types/database";
import { sendPush } from "./push";

export type RestaurantNotificationEvent =
  | "order_cutoff_reminder"
  | "price_change"
  | "kitchen_request"
  | "delivery_issue"
  | "restaurant_digest"
  // Finanze → Fatture fornitori / Food cost (20261010010000).
  | "invoice_received"
  | "invoice_anomaly"
  | "food_cost_alert"
  | "payment_due"
  | "finance_digest";

export type RestaurantNotification = {
  event: RestaurantNotificationEvent;
  title: string;
  body: string;
  /** In-app path, e.g. "/riordina". */
  link: string;
  metadata?: Record<string, unknown>;
  /** Groups pushes on the device (same tag replaces the previous one). */
  tag?: string;
};

/** Profile ids of the restaurant's owner + members whose role has `permission`. */
export async function restaurantRecipients(
  restaurantId: string,
  permission: RestaurantPermission,
): Promise<string[]> {
  try {
    const admin = createAdminClient() as any;
    const [restRes, membersRes] = await Promise.all([
      admin.from("restaurants").select("profile_id").eq("id", restaurantId).maybeSingle(),
      admin
        .from("restaurant_members")
        .select("profile_id, role")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .not("accepted_at", "is", null),
    ]);
    const ids = new Set<string>();
    const owner = (restRes.data as { profile_id: string | null } | null)?.profile_id;
    if (owner) ids.add(owner);
    for (const m of (membersRes.data ?? []) as { profile_id: string; role: RestaurantRole }[]) {
      if (RESTAURANT_ROLE_MATRIX[m.role]?.includes(permission)) ids.add(m.profile_id);
    }
    return [...ids];
  } catch (err) {
    console.error("[notifications:restaurant] recipients failed", err);
    return [];
  }
}

export async function notifyProfiles(
  profileIds: string[],
  n: RestaurantNotification,
): Promise<{ sent: number; errors: number }> {
  const stats = { sent: 0, errors: 0 };
  const recipients = [...new Set(profileIds)].filter(Boolean);
  if (recipients.length === 0) return stats;
  try {
    const admin = createAdminClient() as any;
    const { error } = await admin.from("in_app_notifications").insert(
      recipients.map((pid) => ({
        recipient_profile_id: pid,
        event_type: n.event,
        title: n.title,
        body: n.body,
        link: n.link,
        metadata: n.metadata ?? null,
      })),
    );
    if (error) {
      stats.errors += 1;
      console.error("[notifications:restaurant] in_app insert failed", error);
    } else {
      stats.sent += recipients.length;
    }

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, profile_id")
      .in("profile_id", recipients);
    await Promise.all(
      ((subs ?? []) as { id: string; endpoint: string; p256dh: string; auth: string }[]).map(async (sub) => {
        const res = await sendPush(sub, {
          title: n.title,
          body: n.body,
          url: n.link,
          tag: n.tag ?? n.event,
          data: { eventType: n.event, ...(n.metadata ?? {}) },
        });
        if (res.ok) stats.sent += 1;
        else if (!("gone" in res && res.gone)) stats.errors += 1;
      }),
    );
  } catch (err) {
    stats.errors += 1;
    console.error("[notifications:restaurant] fatal", err);
  }
  return stats;
}

/** Notify the team members of a restaurant that hold `permission`. */
export async function notifyRestaurantTeam(
  restaurantId: string,
  permission: RestaurantPermission,
  n: RestaurantNotification,
  options: { excludeProfileIds?: string[] } = {},
): Promise<{ sent: number; errors: number }> {
  const exclude = new Set(options.excludeProfileIds ?? []);
  const ids = (await restaurantRecipients(restaurantId, permission)).filter((id) => !exclude.has(id));
  return notifyProfiles(ids, n);
}
