/* eslint-disable @typescript-eslint/no-explicit-any */
// Restaurant reminders & digests (cron). Protected by a bearer secret:
//   Authorization: Bearer $RESTAURANT_CRON_SECRET   (or Vercel's $CRON_SECRET)
//
//   ?job=cutoffs  every 15–30 min — "ordina entro le 18": deadline within 2 h
//                 and nothing ordered from that supplier since the previous one
//   ?job=prices   daily — price increases of the last 24 h on bought items
//   ?job=digest   weekly (Monday morning) — spend, budget, issues, prices
//   (no job)      cutoffs + prices
//
// Every notification is de-duplicated through restaurant_notification_log and
// fanned out with lib/notifications/restaurant.ts (in-app + web push).

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeEqual } from "@/lib/utils/safe-equal";
import { notifyRestaurantTeam } from "@/lib/notifications/restaurant";
import { nextDeadline, previousDeadlineMs, relativeDayLabel, romeToday } from "@/lib/restaurants/ordering/schedule";
import { formatCurrency } from "@/lib/utils/formatters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REMIND_WINDOW_MS = 2 * 3_600_000;
const DAY = 86_400_000;

function authorized(req: Request): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const secrets = [process.env.RESTAURANT_CRON_SECRET, process.env.CRON_SECRET].filter(Boolean) as string[];
  return secrets.some((s) => safeEqual(auth, `Bearer ${s}`));
}

/** Insert the log row; false when this notification was already sent. */
async function claim(admin: any, restaurantId: string, kind: string, ref: string): Promise<boolean> {
  const { error } = await admin
    .from("restaurant_notification_log")
    .insert({ restaurant_id: restaurantId, kind, ref: ref.slice(0, 200) });
  return !error;
}

const timeFmt = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" });

async function runCutoffs(admin: any, nowMs: number) {
  let sent = 0;
  const { data: rows, error } = await admin
    .from("restaurant_supplier_schedules")
    .select(
      "id, restaurant_id, supplier_id, catalog_id, delivery_weekdays, cutoff_time, lead_days, suppliers(company_name), restaurant_catalogs(supplier_name)",
    )
    .eq("reminder_enabled", true)
    .limit(5000);
  if (error) return { sent, error: error.message };

  for (const r of (rows ?? []) as any[]) {
    const schedule = {
      weekdays: (r.delivery_weekdays ?? []).map(Number),
      cutoffTime: r.cutoff_time,
      leadDays: Number(r.lead_days ?? 1),
    };
    const next = nextDeadline(schedule, nowMs);
    if (!next || next.deadlineMs - nowMs > REMIND_WINDOW_MS) continue;
    const prev = previousDeadlineMs(schedule, nowMs) ?? nowMs - 7 * DAY;
    const since = new Date(prev).toISOString();
    const name: string = r.suppliers?.company_name ?? r.restaurant_catalogs?.supplier_name ?? "il fornitore";

    // Already ordered for this delivery?
    let ordered = false;
    if (r.supplier_id) {
      const { count } = await admin
        .from("order_splits")
        .select("id, orders!inner(restaurant_id, created_at)", { count: "exact", head: true })
        .eq("supplier_id", r.supplier_id)
        .eq("orders.restaurant_id", r.restaurant_id)
        .gte("orders.created_at", since)
        .neq("status", "cancelled");
      ordered = (count ?? 0) > 0;
    } else {
      const { count } = await admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", r.restaurant_id)
        .gte("created_at", since)
        .neq("status", "cancelled")
        .ilike("notes", `%--- ${name.replace(/[%_]/g, "")} (%`);
      ordered = (count ?? 0) > 0;
    }
    if (ordered) continue;
    if (!(await claim(admin, r.restaurant_id, "cutoff", `${r.id}:${next.deadlineMs}`))) continue;

    const res = await notifyRestaurantTeam(r.restaurant_id, "order.submit", {
      event: "order_cutoff_reminder",
      title: `Ordina entro le ${timeFmt.format(new Date(next.deadlineMs))}`,
      body: `${name}: ultimo momento per la consegna di ${relativeDayLabel(next.deliveryDate, nowMs)}.`,
      link: "/riordina",
      metadata: { scheduleId: r.id, deadlineMs: next.deadlineMs },
      tag: `cutoff:${r.id}`,
    });
    sent += res.sent;
  }
  return { sent };
}

async function runPrices(admin: any, nowMs: number) {
  let sent = 0;
  const since = new Date(nowMs - DAY).toISOString();
  const day = romeToday(nowMs);

  // Catalog increases of the last 24 h, grouped per restaurant.
  const { data: changes, error } = await admin
    .from("restaurant_catalog_price_changes")
    .select("catalog_id, product_name, old_price, new_price, restaurant_catalogs!inner(restaurant_id, supplier_name)")
    .gte("changed_at", since)
    .limit(5000);
  if (error) return { sent, error: error.message };
  const byRestaurant = new Map<string, { name: string; supplier: string; pct: number }[]>();
  for (const c of (changes ?? []) as any[]) {
    const oldP = Number(c.old_price);
    const newP = Number(c.new_price);
    if (!(newP > oldP) || oldP <= 0) continue;
    const rid = c.restaurant_catalogs?.restaurant_id;
    if (!rid) continue;
    const arr = byRestaurant.get(rid) ?? [];
    arr.push({ name: c.product_name, supplier: c.restaurant_catalogs.supplier_name, pct: ((newP - oldP) / oldP) * 100 });
    byRestaurant.set(rid, arr);
  }
  for (const [rid, list] of byRestaurant) {
    if (!(await claim(admin, rid, "prices", day))) continue;
    list.sort((a, b) => b.pct - a.pct);
    const top = list
      .slice(0, 3)
      .map((x) => `${x.name} +${x.pct.toFixed(0)}%`)
      .join(", ");
    const res = await notifyRestaurantTeam(rid, "order.submit", {
      event: "price_change",
      title: `${list.length} aument${list.length === 1 ? "o" : "i"} di prezzo nei listini`,
      body: `${top}${list.length > 3 ? "…" : ""}`,
      link: "/prezzi",
      tag: `prices:${day}`,
    });
    sent += res.sent;
  }
  return { sent };
}

async function runDigest(admin: any, nowMs: number) {
  let sent = 0;
  const weekAgo = new Date(nowMs - 7 * DAY).toISOString();
  const twoWeeksAgo = new Date(nowMs - 14 * DAY).toISOString();
  const now = new Date(nowMs);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const week = `${romeToday(nowMs)}`;

  const { data: orders, error } = await admin
    .from("orders")
    .select("restaurant_id, total, created_at, status")
    .gte("created_at", monthStart < twoWeeksAgo ? monthStart : twoWeeksAgo)
    .neq("status", "cancelled")
    .limit(20000);
  if (error) return { sent, error: error.message };

  type Acc = { week: number; prev: number; month: number; count: number };
  const acc = new Map<string, Acc>();
  for (const o of (orders ?? []) as { restaurant_id: string; total: number | string; created_at: string }[]) {
    const a = acc.get(o.restaurant_id) ?? { week: 0, prev: 0, month: 0, count: 0 };
    const t = Number(o.total ?? 0);
    if (o.created_at >= weekAgo) {
      a.week += t;
      a.count += 1;
    } else if (o.created_at >= twoWeeksAgo) a.prev += t;
    if (o.created_at >= monthStart) a.month += t;
    acc.set(o.restaurant_id, a);
  }
  const ids = [...acc.keys()];
  if (ids.length === 0) return { sent };

  const [budgetsRes, issuesRes] = await Promise.all([
    admin.from("restaurants").select("id, monthly_budget_eur").in("id", ids),
    admin
      .from("delivery_checks")
      .select("restaurant_id, issue_count")
      .in("restaurant_id", ids)
      .gte("checked_at", weekAgo)
      .eq("outcome", "issues"),
  ]);
  const budget = new Map(((budgetsRes.data ?? []) as any[]).map((r) => [r.id, r.monthly_budget_eur as number | null]));
  const issues = new Map<string, number>();
  for (const r of (issuesRes.data ?? []) as any[]) issues.set(r.restaurant_id, (issues.get(r.restaurant_id) ?? 0) + r.issue_count);

  for (const [rid, a] of acc) {
    if (a.week === 0 && a.prev === 0) continue;
    if (!(await claim(admin, rid, "digest", week))) continue;
    const parts: string[] = [];
    const delta = a.prev > 0 ? ((a.week - a.prev) / a.prev) * 100 : null;
    parts.push(
      `Spesa 7 giorni ${formatCurrency(a.week)}${delta !== null ? ` (${delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(0)}%)` : ""}, ${a.count} ordini`,
    );
    const b = budget.get(rid);
    if (b && b > 0) parts.push(`budget del mese al ${Math.round((a.month / b) * 100)}%`);
    const iss = issues.get(rid) ?? 0;
    if (iss > 0) parts.push(`${iss} problemi alle consegne`);
    const res = await notifyRestaurantTeam(rid, "analytics.financial", {
      event: "restaurant_digest",
      title: "Il riepilogo della settimana",
      body: parts.join(" · "),
      link: "/analytics",
      tag: `digest:${week}`,
    });
    sent += res.sent;
  }
  return { sent };
}

async function handle(req: Request) {
  if (!process.env.RESTAURANT_CRON_SECRET && !process.env.CRON_SECRET) {
    return NextResponse.json({ error: "RESTAURANT_CRON_SECRET not configured" }, { status: 500 });
  }
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const job = new URL(req.url).searchParams.get("job");
  const admin = createAdminClient() as any;
  const nowMs = Date.now();
  const out: Record<string, unknown> = {};
  if (!job || job === "cutoffs") out.cutoffs = await runCutoffs(admin, nowMs);
  if (!job || job === "prices") out.prices = await runPrices(admin, nowMs);
  if (job === "digest") out.digest = await runDigest(admin, nowMs);
  return NextResponse.json(out);
}

export const GET = handle;
export const POST = handle;
