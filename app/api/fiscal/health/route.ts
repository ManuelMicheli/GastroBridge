// app/api/fiscal/health/route.ts
// Admin health check for Cassetto Fiscale integrations.
// Bearer auth via FISCAL_CRON_SECRET (reused so ops + cron share one token).

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

type HealthRow = {
  integration_id: string;
  restaurant_id: string;
  provider: string;
  status: string;
  display_name: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  errors_24h: number;
  pull_runs_24h: number;
  raw_events_24h: number;
  pending_events: number;
};

export async function GET(request: Request) {
  const secret = process.env.FISCAL_CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "FISCAL_CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient() as Loose;
  const { data, error } = await supabase
    .from("fiscal_integrations_health")
    .select("*");

  if (error) {
    return NextResponse.json(
      { error: `health query failed: ${error.message}` },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as HealthRow[];
  const degraded = rows.filter(
    (r) =>
      r.status === "error" ||
      r.errors_24h >= 3 ||
      (r.status === "active" && r.pending_events > 100),
  );
  const overall =
    rows.length === 0
      ? "empty"
      : degraded.length === 0
        ? "healthy"
        : "degraded";

  return NextResponse.json({
    overall,
    integrations_total: rows.length,
    integrations_degraded: degraded.length,
    integrations: rows,
    checked_at: new Date().toISOString(),
  });
}
