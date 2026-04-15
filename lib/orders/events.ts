/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Order split event emission + optional notification fan-out.
 *
 * Inserts a row into `order_split_events` (audit log — idempotency not required)
 * and, for the most relevant event types, triggers the notifications dispatcher.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchEvent, type NotificationEventType } from "@/lib/notifications/dispatcher";

export type OrderSplitEventType =
  | "received"
  | "accepted"
  | "partially_accepted"
  | "rejected"
  | "stock_conflict"
  | "preparing"
  | "packed"
  | "shipped"
  | "delivered"
  | "canceled";

export interface EmitSplitEventInput {
  splitId: string;
  eventType: OrderSplitEventType;
  memberId?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Insert a row into `order_split_events`. Caller supplies the supabase client
 * (so this works inside server actions with the caller's RLS context).
 */
export async function emitSplitEvent(
  supabase: SupabaseClient<any, any, any>,
  input: EmitSplitEventInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { splitId, eventType, memberId, note, metadata } = input;
  const { data, error } = await (supabase as any)
    .from("order_split_events")
    .insert({
      order_split_id: splitId,
      event_type: eventType,
      member_id: memberId ?? null,
      note: note ?? null,
      metadata: metadata ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[orders:events] emitSplitEvent failed", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, id: (data as { id: string }).id };
}

/**
 * Map a raw order_split_event_type to a NotificationEventType, if any.
 * Returns null when the event should NOT trigger a notification.
 */
function mapToNotificationEvent(eventType: OrderSplitEventType): NotificationEventType | null {
  switch (eventType) {
    case "received":
      return "order_received";
    case "accepted":
    case "partially_accepted":
      return "order_accepted";
    case "shipped":
      return "order_shipped";
    case "delivered":
      return "order_delivered";
    default:
      return null;
  }
}

export interface EmitAndNotifyInput extends EmitSplitEventInput {
  /** Provide supplier id to dispatch to supplier members. */
  supplierId?: string | null;
  /** Restaurant profile ids to also receive in-app copies (order_accepted, order_shipped, order_delivered). */
  restaurantProfileIds?: string[];
  /** Extra payload merged into the dispatcher payload. */
  notificationPayload?: Record<string, unknown>;
  /** For order_shipped — the driver assigned (so only that driver gets push). */
  driverMemberId?: string | null;
}

/**
 * Insert the event row AND (best-effort) fan out notifications.
 * Notification failures never throw — they're logged.
 */
export async function emitOrderEvent(
  supabase: SupabaseClient<any, any, any>,
  input: EmitAndNotifyInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const result = await emitSplitEvent(supabase, {
    splitId: input.splitId,
    eventType: input.eventType,
    memberId: input.memberId,
    note: input.note,
    metadata: input.metadata,
  });
  if (!result.ok) return result;

  const notifEvent = mapToNotificationEvent(input.eventType);
  if (notifEvent && input.supplierId) {
    const payload: Record<string, unknown> = {
      splitId: input.splitId,
      ...(input.notificationPayload ?? {}),
    };
    try {
      await dispatchEvent(notifEvent, input.supplierId, payload, {
        extraProfileIds: input.restaurantProfileIds,
        driverMemberId: input.driverMemberId,
      });
    } catch (err) {
      console.error("[orders:events] dispatchEvent failed", err);
    }
  }

  return result;
}

/**
 * Server-side convenience: emit from any context without a caller client.
 * Uses the admin (service-role) client — callers MUST ensure authorization upstream.
 */
export async function emitOrderEventAsAdmin(
  input: EmitAndNotifyInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const admin = createAdminClient();
  return emitOrderEvent(admin as unknown as SupabaseClient<any, any, any>, input);
}
