/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Notifications dispatcher.
 *
 * Routes an event to email + push + in-app channels per user preferences,
 * defaulting to the matrix in spec §8.2 when no explicit preference row exists.
 *
 * Errors are logged via console.error and swallowed — we do NOT want to break
 * business transactions because a push/email send failed.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "./email";
import { sendPush } from "./push";
import { renderTemplate } from "./templates";

export type NotificationEventType =
  | "order_received"
  | "order_accepted"
  | "order_shipped"
  | "order_delivered"
  | "stock_low"
  | "lot_expiring"
  | "delivery_failed";

export type SupplierRole = "admin" | "sales" | "warehouse" | "driver";
export type NotificationChannel = "email" | "push" | "in_app";

type ChannelSet = Partial<Record<NotificationChannel, true>>;

/**
 * Default matrix (§8.2). For each event, which channels each role receives.
 * `in_app` is tracked locally even though the DB enum only stores `email`/`push`/`sms`
 * (we always insert an in-app row when `in_app` is in the default set and preferences
 * don't explicitly disable it).
 */
const DEFAULT_MATRIX: Record<NotificationEventType, Partial<Record<SupplierRole, ChannelSet>>> = {
  order_received: {
    admin: { in_app: true, email: true, push: true },
    sales: { in_app: true, email: true, push: true },
  },
  order_accepted: {
    admin: { in_app: true },
    sales: { in_app: true },
    warehouse: { in_app: true, push: true },
  },
  order_shipped: {
    admin: { in_app: true },
    sales: { in_app: true },
    warehouse: { in_app: true },
    driver: { in_app: true, push: true },
  },
  // Not in spec §8.2 matrix — minimal default so the type is complete.
  order_delivered: {
    admin: { in_app: true },
    sales: { in_app: true },
  },
  stock_low: {
    admin: { in_app: true, email: true },
    warehouse: { in_app: true, push: true },
  },
  lot_expiring: {
    admin: { in_app: true, email: true },
    warehouse: { in_app: true, email: true },
  },
  delivery_failed: {
    admin: { in_app: true, email: true, push: true },
    sales: { in_app: true, email: true },
  },
};

export interface DispatchOptions {
  /** Optional extra profile IDs to include as recipients (e.g. restaurant user for order_accepted). */
  extraProfileIds?: string[];
  /** Restrict to this specific driver member (used by order_shipped). */
  driverMemberId?: string | null;
  /** Base URL used to build links inside templates/emails. */
  baseUrl?: string;
}

interface Recipient {
  profileId: string;
  memberId?: string;
  role?: SupplierRole;
  channels: ChannelSet;
}

/**
 * Resolve channel preferences for a given member.
 * DB stores rows keyed by (member, event, channel) with `enabled` boolean.
 * Returns the effective set merging defaults with overrides.
 */
function applyPreferences(
  defaults: ChannelSet,
  overrides: Array<{ channel: string; enabled: boolean }>
): ChannelSet {
  const result: ChannelSet = { ...defaults };
  for (const row of overrides) {
    const ch = row.channel as NotificationChannel;
    if (!row.enabled) delete result[ch];
    else result[ch] = true;
  }
  return result;
}

/**
 * Dispatch a notification event.
 *
 * @param eventType  which event fired
 * @param supplierId supplier whose members may receive the notification
 * @param payload    free-form context used by templates (splitId, orderNumber, productName, etc.)
 * @param options    optional tweaks (extra recipients, base URL)
 */
export async function dispatchEvent(
  eventType: NotificationEventType,
  supplierId: string,
  payload: Record<string, unknown>,
  options: DispatchOptions = {}
): Promise<{ sent: number; errors: number }> {
  const stats = { sent: 0, errors: 0 };
  const baseUrl =
    options.baseUrl ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "";

  try {
    const supabase = createAdminClient();
    const matrix = DEFAULT_MATRIX[eventType] ?? {};

    // 1. Fetch active supplier members whose role is in the default matrix for this event.
    const rolesNeeded = Object.keys(matrix) as SupplierRole[];
    const recipients: Recipient[] = [];

    if (rolesNeeded.length > 0 && supplierId) {
      const { data: members, error: mErr } = await (supabase as any)
        .from("supplier_members")
        .select("id, profile_id, role, is_active")
        .eq("supplier_id", supplierId)
        .eq("is_active", true)
        .in("role", rolesNeeded);

      if (mErr) {
        console.error("[notifications:dispatch] supplier_members query failed", mErr);
      } else if (members) {
        for (const m of members as Array<{ id: string; profile_id: string; role: SupplierRole }>) {
          // If this is an order_shipped event and a driver is assigned, only that driver gets push.
          if (eventType === "order_shipped" && m.role === "driver") {
            if (options.driverMemberId && options.driverMemberId !== m.id) continue;
          }
          recipients.push({
            profileId: m.profile_id,
            memberId: m.id,
            role: m.role,
            channels: { ...(matrix[m.role] ?? {}) },
          });
        }
      }

      // 2. Fetch preferences for all members in one shot, apply overrides.
      const memberIds = recipients.map((r) => r.memberId).filter(Boolean) as string[];
      if (memberIds.length > 0) {
        const { data: prefs } = await (supabase as any)
          .from("notification_preferences")
          .select("supplier_member_id, channel, event_type, enabled")
          .in("supplier_member_id", memberIds)
          .eq("event_type", eventType);

        if (prefs) {
          const byMember = new Map<string, Array<{ channel: string; enabled: boolean }>>();
          for (const p of prefs as Array<{
            supplier_member_id: string;
            channel: string;
            enabled: boolean;
          }>) {
            const arr = byMember.get(p.supplier_member_id) ?? [];
            arr.push({ channel: p.channel, enabled: p.enabled });
            byMember.set(p.supplier_member_id, arr);
          }
          for (const r of recipients) {
            if (!r.memberId) continue;
            const overrides = byMember.get(r.memberId) ?? [];
            r.channels = applyPreferences(r.channels, overrides);
          }
        }
      }
    }

    // 3. Extra profile IDs (e.g. restaurant owner for order_accepted/shipped) — always in-app only by default.
    for (const pid of options.extraProfileIds ?? []) {
      recipients.push({ profileId: pid, channels: { in_app: true } });
    }

    if (recipients.length === 0) return stats;

    // 4. For each recipient, dispatch per channel in parallel. Errors are logged, not thrown.
    await Promise.all(
      recipients.map(async (r) => {
        const tpl = renderTemplate(eventType, { payload, baseUrl });

        // 4a. in-app row
        if (r.channels.in_app) {
          try {
            const { error } = await (supabase as any).from("in_app_notifications").insert({
              recipient_profile_id: r.profileId,
              event_type: eventType,
              title: tpl.title,
              body: tpl.body,
              link: tpl.link,
              metadata: payload as any,
            });
            if (error) {
              stats.errors++;
              console.error("[notifications:dispatch] in_app insert failed", error);
            } else {
              stats.sent++;
            }
          } catch (err) {
            stats.errors++;
            console.error("[notifications:dispatch] in_app exception", err);
          }
        }

        // 4b. email — need the profile's auth email
        if (r.channels.email) {
          try {
            const { data: authUser } = await (supabase as any).auth.admin.getUserById(r.profileId);
            const email: string | undefined = authUser?.user?.email;
            if (email) {
              const result = await sendEmail({
                to: email,
                subject: tpl.subject,
                html: tpl.html,
                text: tpl.text,
              });
              if (result.ok) stats.sent++;
              else stats.errors++;
            } else {
              console.warn("[notifications:dispatch] no email for profile", r.profileId);
            }
          } catch (err) {
            stats.errors++;
            console.error("[notifications:dispatch] email exception", err);
          }
        }

        // 4c. push — fan out to all subscriptions for this profile
        if (r.channels.push) {
          try {
            const { data: subs } = await (supabase as any)
              .from("push_subscriptions")
              .select("id, endpoint, p256dh, auth")
              .eq("profile_id", r.profileId);

            for (const sub of (subs ?? []) as Array<{
              id: string;
              endpoint: string;
              p256dh: string;
              auth: string;
            }>) {
              const result = await sendPush(sub, {
                title: tpl.title,
                body: tpl.body,
                url: tpl.link,
                tag: `${eventType}:${(payload.splitId as string) ?? r.profileId}`,
                data: { eventType, ...payload },
              });
              if (result.ok) stats.sent++;
              else stats.errors++;
            }
          } catch (err) {
            stats.errors++;
            console.error("[notifications:dispatch] push exception", err);
          }
        }
      })
    );
  } catch (err) {
    stats.errors++;
    console.error("[notifications:dispatch] fatal", err);
  }

  return stats;
}
