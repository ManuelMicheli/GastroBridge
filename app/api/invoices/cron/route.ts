// app/api/invoices/cron/route.ts
// Safety net + daily digest for supplier invoices (Vercel Cron, see
// vercel.json; any scheduler can call it).
//
// Auth: `Authorization: Bearer <CRON_SECRET>` (what Vercel Cron sends) or the
// `x-cron-token` header used by the other cron endpoints of the repo.
// Query `?task=` all (default) | events | sync | digest.
//
//   events → retry webhook events stuck in received/error (≤ 5 attempts)
//   sync   → pull invoices received since the last sync for every connection
//   digest → one finance digest notification per restaurant per day

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeEqual } from "@/lib/utils/safe-equal";
import { applyLimit, cronLimiter } from "@/lib/utils/rate-limit";
import { allSyncableConnections, processInboundEvent, syncConnection } from "@/lib/invoices/server/sdi";
import { sendDailyDigest } from "@/lib/invoices/server/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const token = request.headers.get("x-cron-token") ?? bearer;
  return token.length > 0 && safeEqual(token, expected);
}

async function run(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limit = await applyLimit(cronLimiter, "cron:invoices");
  if (!limit.allowed) return NextResponse.json({ error: "rate limited" }, { status: 429 });

  const task = new URL(request.url).searchParams.get("task") ?? "all";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const out: Record<string, unknown> = {};

  if (task === "all" || task === "events") {
    const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data } = await admin
      .from("sdi_inbound_events")
      .select("id")
      .in("status", ["received", "error"])
      .lt("attempts", 5)
      .lte("received_at", cutoff)
      .order("received_at", { ascending: true })
      .limit(100);
    let retried = 0;
    for (const ev of (data ?? []) as Array<{ id: string }>) {
      await processInboundEvent(ev.id);
      retried++;
    }
    out.events = retried;
  }

  if (task === "all" || task === "sync") {
    const results: Array<{ restaurant: string; imported: number; error: string | null }> = [];
    for (const conn of await allSyncableConnections()) {
      const r = await syncConnection(conn);
      results.push({ restaurant: conn.restaurant_id, ...r });
    }
    out.sync = results;
  }

  if (task === "all" || task === "digest") {
    const since = new Date(Date.now() - 60 * 86400 * 1000).toISOString();
    const [{ data: inv }, { data: conns }] = await Promise.all([
      admin.from("supplier_invoices").select("restaurant_id").gte("created_at", since).limit(20000),
      admin.from("sdi_connections").select("restaurant_id"),
    ]);
    const ids = new Set<string>([
      ...((inv ?? []) as Array<{ restaurant_id: string }>).map((r) => r.restaurant_id),
      ...((conns ?? []) as Array<{ restaurant_id: string }>).map((r) => r.restaurant_id),
    ]);
    let sent = 0;
    for (const id of ids) if (await sendDailyDigest(id)) sent++;
    out.digest = sent;
  }

  return NextResponse.json({ ok: true, ...out });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
