// lib/invoices/server/notify.ts
// Finance notifications (in-app bell + web push) for the restaurant team
// members who can see financial data (owner + analytics.financial).
//
// Batching policy:
//   * immediately: only HIGH severity invoice anomalies (e.g. a duplicate or a
//     big price difference) and dishes that jump ≥ 5 points over target;
//   * everything else goes into ONE daily digest (new invoices, open
//     anomalies, payment due dates, disputes without credit note, food cost).
// De-duplicated through finance_notification_log. Never throws.

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/notifications/push";
import { RESTAURANT_ROLE_MATRIX } from "@/lib/restaurants/permissions";
import type { RestaurantRole } from "@/types/database";
import { formatEuroCents } from "../dispute.ts";
import type { FoodCostAlert } from "@/lib/food-cost/analysis";
import { CREDIT_NOTE_GRACE_DAYS } from "../status.ts";
import { addDaysIso, isoDate, rows, type Db } from "./db";
import type { IngestReport } from "./pipeline";

type FinanceEvent = "invoice_received" | "invoice_anomaly" | "food_cost_alert" | "payment_due" | "finance_digest";

interface FinanceNotification {
  event: FinanceEvent;
  title: string;
  body: string;
  link: string;
  tag: string;
  metadata?: Record<string, unknown>;
}

async function recipients(admin: Db, restaurantId: string): Promise<string[]> {
  const [rest, members] = await Promise.all([
    admin.from("restaurants").select("profile_id").eq("id", restaurantId).maybeSingle(),
    rows<{ profile_id: string; role: RestaurantRole }>(
      admin
        .from("restaurant_members")
        .select("profile_id, role")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .not("accepted_at", "is", null),
      "members",
    ),
  ]);
  const ids = new Set<string>();
  const owner = (rest.data as { profile_id: string | null } | null)?.profile_id;
  if (owner) ids.add(owner);
  for (const m of members) if (RESTAURANT_ROLE_MATRIX[m.role]?.includes("analytics.financial")) ids.add(m.profile_id);
  return [...ids];
}

/** Claim a (kind, ref) slot; false when already sent. */
async function claim(admin: Db, restaurantId: string, kind: string, ref: string): Promise<boolean> {
  const { error } = await admin.from("finance_notification_log").insert({ restaurant_id: restaurantId, kind, ref: ref.slice(0, 200) });
  return !error;
}

async function send(admin: Db, restaurantId: string, n: FinanceNotification): Promise<void> {
  const ids = await recipients(admin, restaurantId);
  if (ids.length === 0) return;
  const { error } = await admin.from("in_app_notifications").insert(
    ids.map((pid) => ({
      recipient_profile_id: pid,
      event_type: n.event,
      title: n.title,
      body: n.body,
      link: n.link,
      metadata: n.metadata ?? null,
    })),
  );
  if (error) console.error("[finance:notify] in-app insert failed", error.message);
  const subs = await rows<{ id: string; endpoint: string; p256dh: string; auth: string }>(
    admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").in("profile_id", ids),
    "push subs",
  );
  await Promise.all(
    subs.map((s) => sendPush(s, { title: n.title, body: n.body, url: n.link, tag: n.tag, data: { eventType: n.event, ...(n.metadata ?? {}) } })),
  );
}

/** Immediate alerts after an automatic import (webhook / sync). */
export async function notifyAfterIngest(restaurantId: string, report: IngestReport, alerts: FoodCostAlert[]): Promise<void> {
  try {
    const admin = createAdminClient() as Db;
    for (const inv of report.imported) {
      if (inv.highSeverity === 0) continue;
      if (!(await claim(admin, restaurantId, "invoice_anomaly", inv.id))) continue;
      const who = inv.supplierName ?? "fornitore";
      await send(admin, restaurantId, {
        event: "invoice_anomaly",
        title: `Nuova fattura da ${who}: ${inv.findings} ${inv.findings === 1 ? "anomalia" : "anomalie"}${inv.openCents > 0 ? ` (${formatEuroCents(inv.openCents)})` : ""}`,
        body: `Fattura n. ${inv.number}: controlla le differenze e contesta con un clic.`,
        link: `/finanze/fatture/${inv.id}`,
        tag: `invoice-${inv.id}`,
        metadata: { invoiceId: inv.id },
      });
    }
    for (const a of alerts) {
      if (a.toPct - a.targetPct < 5) continue;
      if (!(await claim(admin, restaurantId, "food_cost_alert", `${a.recipeId}:${isoDate(new Date())}`))) continue;
      await send(admin, restaurantId, {
        event: "food_cost_alert",
        title: `Food cost: ${a.recipeName} al ${Math.round(a.toPct)}%`,
        body: a.message,
        link: `/finanze/ricette/${a.recipeId}`,
        tag: `foodcost-${a.recipeId}`,
      });
    }
  } catch (err) {
    console.error("[finance:notify] after ingest failed", err);
  }
}

/** One daily digest per restaurant (sent by the cron). */
export async function sendDailyDigest(restaurantId: string, today = new Date()): Promise<boolean> {
  try {
    const admin = createAdminClient() as Db;
    const day = isoDate(today);
    const since = new Date(today.getTime() - 24 * 3600 * 1000).toISOString();
    const in7 = addDaysIso(day, 7);
    const graceLimit = new Date(today.getTime() - CREDIT_NOTE_GRACE_DAYS * 86400 * 1000).toISOString();

    const [fresh, open, due, stale, alerts] = await Promise.all([
      rows<{ id: string; status: string }>(
        admin.from("supplier_invoices").select("id, status").eq("restaurant_id", restaurantId).gte("created_at", since),
        "digest fresh",
      ),
      rows<{ open_cents: number }>(
        admin.from("supplier_invoices").select("open_cents").eq("restaurant_id", restaurantId).eq("status", "anomalie"),
        "digest open",
      ),
      rows<{ amount: number | null; due_date: string }>(
        admin
          .from("supplier_invoice_payments")
          .select("amount, due_date")
          .eq("restaurant_id", restaurantId)
          .is("paid_at", null)
          .gte("due_date", day)
          .lte("due_date", in7),
        "digest due",
      ),
      rows<{ id: string }>(
        admin.from("supplier_invoice_disputes").select("id").eq("restaurant_id", restaurantId).is("resolved_at", null).lte("created_at", graceLimit),
        "digest stale",
      ),
      rows<{ message: string }>(
        admin.from("food_cost_alerts").select("message").eq("restaurant_id", restaurantId).is("dismissed_at", null).gte("created_at", since),
        "digest alerts",
      ),
    ]);
    const parts: string[] = [];
    if (fresh.length > 0) parts.push(`${fresh.length} ${fresh.length === 1 ? "fattura nuova" : "fatture nuove"}`);
    const openCents = open.reduce((s, r) => s + Number(r.open_cents), 0);
    if (openCents > 0) parts.push(`${formatEuroCents(openCents)} da recuperare`);
    if (due.length > 0) {
      const tot = due.reduce((s, r) => s + Math.round(Number(r.amount ?? 0) * 100), 0);
      parts.push(`${due.length} ${due.length === 1 ? "scadenza" : "scadenze"} entro 7 giorni (${formatEuroCents(tot)})`);
    }
    if (stale.length > 0) parts.push(`${stale.length} ${stale.length === 1 ? "contestazione" : "contestazioni"} senza nota di credito`);
    if (alerts.length > 0) parts.push(`${alerts.length} ${alerts.length === 1 ? "piatto sopra" : "piatti sopra"} il food cost obiettivo`);
    if (parts.length === 0) return false;
    if (!(await claim(admin, restaurantId, "finance_digest", day))) return false;
    await send(admin, restaurantId, {
      event: "finance_digest",
      title: "Riepilogo Finanze di oggi",
      body: parts.join(" · "),
      link: "/finanze/fatture",
      tag: `finance-digest-${day}`,
    });
    return true;
  } catch (err) {
    console.error("[finance:notify] digest failed", err);
    return false;
  }
}
