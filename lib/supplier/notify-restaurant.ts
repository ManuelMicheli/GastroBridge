/* eslint-disable @typescript-eslint/no-explicit-any */
// Restaurant-facing notifications sent by supplier features (ETA, price
// changes, orders keyed by sales). Reuses the existing infra: an in-app row
// in `in_app_notifications` (service role, like the dispatcher) + web push
// to the owner's subscriptions. Best-effort: never throws.
//
// CALLERS MUST AUTHORISE FIRST (membership + permission of the supplier and
// a relationship with the restaurant): this helper writes with the service
// role.

import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/notifications/push";

export type RestaurantNotice = {
  /** New enum value (migration 20261009000000); `fallbackEventType` is used if it is not there yet. */
  eventType: "delivery_eta" | "price_change_scheduled" | "order_created_by_supplier";
  fallbackEventType?: "order_shipped" | "order_accepted" | "order_received";
  title: string;
  body: string;
  link?: string;
  metadata?: Record<string, unknown>;
};

export async function notifyRestaurants(restaurantIds: string[], notice: RestaurantNotice): Promise<number> {
  const ids = [...new Set(restaurantIds)].filter(Boolean);
  if (ids.length === 0) return 0;
  let sent = 0;
  try {
    const admin = createAdminClient() as any;
    const { data: rests } = (await admin.from("restaurants").select("id, profile_id").in("id", ids)) as {
      data: Array<{ id: string; profile_id: string }> | null;
    };
    const profileIds = [...new Set((rests ?? []).map((r) => r.profile_id).filter(Boolean))];
    for (const profileId of profileIds) {
      const row = {
        recipient_profile_id: profileId,
        event_type: notice.eventType,
        title: notice.title,
        body: notice.body,
        link: notice.link ?? null,
        metadata: notice.metadata ?? null,
      };
      let { error } = await admin.from("in_app_notifications").insert(row);
      if (error && notice.fallbackEventType) {
        ({ error } = await admin
          .from("in_app_notifications")
          .insert({ ...row, event_type: notice.fallbackEventType }));
      }
      if (!error) sent++;

      const { data: subs } = (await admin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("profile_id", profileId)) as {
        data: Array<{ id: string; endpoint: string; p256dh: string; auth: string }> | null;
      };
      for (const sub of subs ?? []) {
        await sendPush(sub, {
          title: notice.title,
          body: notice.body,
          url: notice.link,
          tag: `${notice.eventType}:${profileId}`,
          data: { eventType: notice.eventType, ...(notice.metadata ?? {}) },
        });
      }
    }
  } catch (err) {
    console.error("[supplier:notify-restaurants] failed", err);
  }
  return sent;
}
