/**
 * Web-push wrapper.
 * Reads VAPID keys from env (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT).
 * On 404/410 responses (endpoint gone) deletes the subscription row from push_subscriptions.
 */

import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

let _configured = false;
let _configurable: boolean | null = null;

function configure(): boolean {
  if (_configured) return true;
  if (_configurable === false) return false;

  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:ordini@gastrobridge.it";

  if (!pub || !priv) {
    _configurable = false;
    console.warn("[notifications:push] VAPID keys missing — push disabled");
    return false;
  }

  webpush.setVapidDetails(subject, pub, priv);
  _configured = true;
  _configurable = true;
  return true;
}

export interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export async function sendPush(
  subscription: PushSubscriptionRow,
  payload: PushPayload
): Promise<{ ok: true } | { ok: false; error: string; gone?: boolean }> {
  if (!configure()) {
    return { ok: false, error: "VAPID not configured" };
  }

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };

  try {
    await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
    return { ok: true };
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number })?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      // Subscription is gone — delete it so we don't retry forever.
      try {
        const admin = createAdminClient();
        await admin.from("push_subscriptions").delete().eq("id", subscription.id);
      } catch (delErr) {
        console.error("[notifications:push] failed to delete stale subscription", delErr);
      }
      return { ok: false, error: `stale subscription (${statusCode})`, gone: true };
    }
    console.error("[notifications:push] send failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown error" };
  }
}
