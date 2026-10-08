// lib/invoices/server/notify.ts
// Finance notifications (in-app bell + web push) for the restaurant team
// members who can see financial data (owner + analytics.financial), sent
// through the shared restaurant fan-out (lib/notifications/restaurant.ts).
//
// Batching policy:
//   * immediately: only HIGH severity invoice anomalies (e.g. a duplicate or a
//     big price difference), credit notes that settle a dispute ("soldi
//     recuperati") and dishes that jump ≥ 5 points over target;
//   * everything else goes into ONE daily digest (new invoices, open
//     anomalies, payment due dates, disputes without credit note, dishes over
//     their food-cost target).
// De-duplicated through finance_notification_log. Never throws.

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyRestaurantTeam, type RestaurantNotification } from "@/lib/notifications/restaurant";
import { formatEuroCents } from "../dispute.ts";
import type { FoodCostAlert } from "@/lib/food-cost/analysis";
import { CREDIT_NOTE_GRACE_DAYS } from "../status.ts";
import { buildDigest } from "../digest.ts";
import { addDaysIso, isoDate, rows, type Db } from "./db";
import type { IngestReport } from "./pipeline";

/** Claim a (kind, ref) slot; false when already sent. */
async function claim(admin: Db, restaurantId: string, kind: string, ref: string): Promise<boolean> {
  const { error } = await admin.from("finance_notification_log").insert({ restaurant_id: restaurantId, kind, ref: ref.slice(0, 200) });
  return !error;
}

async function send(restaurantId: string, n: RestaurantNotification, exclude: string[] = []): Promise<void> {
  await notifyRestaurantTeam(restaurantId, "analytics.financial", n, { excludeProfileIds: exclude });
}

/**
 * Immediate alerts after an import. `excludeProfileIds`: the person who just
 * uploaded the files sees the result on screen, no need to ping them.
 */
export async function notifyAfterIngest(
  restaurantId: string,
  report: IngestReport,
  alerts: FoodCostAlert[],
  options: { excludeProfileIds?: string[] } = {},
): Promise<void> {
  try {
    const admin = createAdminClient() as Db;
    const exclude = options.excludeProfileIds ?? [];
    for (const inv of report.imported) {
      if (inv.settled && inv.settled.recoveredCents > 0) {
        if (await claim(admin, restaurantId, "credit_note", inv.id)) {
          await send(
            restaurantId,
            {
              event: "invoice_received",
              title: `Nota di credito da ${inv.supplierName ?? "fornitore"}: ${formatEuroCents(inv.settled.recoveredCents)} recuperati`,
              body: `La contestazione della fattura n. ${inv.settled.invoiceNumber} è stata chiusa in automatico.`,
              link: `/finanze/fatture/${inv.settled.invoiceId}`,
              tag: `credit-${inv.id}`,
              metadata: { invoiceId: inv.settled.invoiceId, creditNoteId: inv.id },
            },
            exclude,
          );
        }
        continue;
      }
      if (inv.highSeverity === 0) continue;
      if (!(await claim(admin, restaurantId, "invoice_anomaly", inv.id))) continue;
      const who = inv.supplierName ?? "fornitore";
      await send(
        restaurantId,
        {
          event: "invoice_anomaly",
          title: `Fattura ${who}: ${inv.findings} ${inv.findings === 1 ? "anomalia" : "anomalie"}${inv.openCents > 0 ? ` (${formatEuroCents(inv.openCents)})` : ""}`,
          body: `Fattura n. ${inv.number}: controlla le differenze e contesta con un clic.`,
          link: `/finanze/fatture/${inv.id}`,
          tag: `invoice-${inv.id}`,
          metadata: { invoiceId: inv.id },
        },
        exclude,
      );
    }
    for (const a of alerts) {
      if (a.toPct - a.targetPct < 5) continue;
      if (!(await claim(admin, restaurantId, "food_cost_alert", `${a.recipeId}:${isoDate(new Date())}`))) continue;
      await send(
        restaurantId,
        {
          event: "food_cost_alert",
          title: `Food cost: ${a.recipeName} al ${Math.round(a.toPct)}%`,
          body: a.message,
          link: `/finanze/ricette/${a.recipeId}`,
          tag: `foodcost-${a.recipeId}`,
        },
        exclude,
      );
    }
  } catch (err) {
    console.error("[finance:notify] after ingest failed", err);
  }
}

/** One daily digest per restaurant (sent by the invoices cron). */
export async function sendDailyDigest(restaurantId: string, today = new Date()): Promise<boolean> {
  try {
    const admin = createAdminClient() as Db;
    const day = isoDate(today);
    const since = new Date(today.getTime() - 24 * 3600 * 1000).toISOString();
    const in7 = addDaysIso(day, 7);
    const overdueFrom = addDaysIso(day, -60);
    const graceLimit = new Date(today.getTime() - CREDIT_NOTE_GRACE_DAYS * 86400 * 1000).toISOString();

    const [fresh, open, due, stale, dishes] = await Promise.all([
      rows<{ id: string }>(
        admin.from("supplier_invoices").select("id").eq("restaurant_id", restaurantId).gte("created_at", since),
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
          .gte("due_date", overdueFrom)
          .lte("due_date", in7),
        "digest due",
      ),
      rows<{ id: string }>(
        admin.from("supplier_invoice_disputes").select("id").eq("restaurant_id", restaurantId).is("resolved_at", null).lte("created_at", graceLimit),
        "digest stale",
      ),
      rows<{ last_food_cost_pct: number | null; target_food_cost_pct: number }>(
        admin
          .from("recipes")
          .select("last_food_cost_pct, target_food_cost_pct")
          .eq("restaurant_id", restaurantId)
          .eq("kind", "dish")
          .eq("is_active", true)
          .not("last_food_cost_pct", "is", null),
        "digest dishes",
      ),
    ]);
    const upcoming = due.filter((d) => d.due_date >= day);
    const digest = buildDigest({
      newInvoices: fresh.length,
      anomalies: open.length,
      openCents: open.reduce((s, r) => s + Number(r.open_cents), 0),
      dueCount: upcoming.length,
      dueCents: upcoming.reduce((s, r) => s + Math.round(Number(r.amount ?? 0) * 100), 0),
      overdueCount: due.length - upcoming.length,
      staleDisputes: stale.length,
      dishesOverTarget: dishes.filter((d) => Number(d.last_food_cost_pct) > Number(d.target_food_cost_pct)).length,
    });
    if (digest.parts.length === 0) return false;
    if (!(await claim(admin, restaurantId, "finance_digest", day))) return false;
    await send(restaurantId, {
      event: "finance_digest",
      title: "Finanze: il riepilogo di oggi",
      body: digest.parts.join(" · "),
      link: digest.link,
      tag: `finance-digest-${day}`,
    });
    return true;
  } catch (err) {
    console.error("[finance:notify] digest failed", err);
    return false;
  }
}
