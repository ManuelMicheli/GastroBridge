// Applies due scheduled price changes for every supplier (service role).
// Auth: shared secret via `x-cron-token` (or `Authorization: Bearer`) header,
// compared to CRON_SECRET — same convention as /api/search/sync.
// Schedule it once a day shortly after midnight (Europe/Rome), e.g. from
// pg_cron + pg_net or the hosting scheduler. Suppliers that open Listini also
// apply their own due changes lazily, so a missed run is self-healing.

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeEqual } from "@/lib/utils/safe-equal";
import { applyDueScheduledChanges } from "@/lib/supplier/pricing/scheduled-core";

export async function POST(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const token = request.headers.get("x-cron-token") ?? bearer;
  const expected = process.env.CRON_SECRET;
  if (!expected || !safeEqual(token, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as unknown as SupabaseClient<any, any, any>;
    const result = await applyDueScheduledChanges(admin);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[cron:price-changes] failed", error);
    return NextResponse.json({ error: "Apply failed" }, { status: 500 });
  }
}
