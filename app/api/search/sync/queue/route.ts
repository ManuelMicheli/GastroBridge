import { NextResponse } from "next/server";
import { processOutboxBatch } from "@/lib/meilisearch/sync";

// Outbox worker: drains meilisearch_sync_queue and applies to Meilisearch.
// Invoked by pg_cron (or external scheduler) ~every 30s.
//
// Auth: shared secret via X-Cron-Token header, compared to CRON_SECRET env.
// Single-writer assumption — if scheduled concurrently the outbox coalesces
// correctly but duplicate work is wasted. Keep the cron schedule sparse.

export async function POST(request: Request) {
  const token = request.headers.get("x-cron-token");
  const expected = process.env.CRON_SECRET;
  if (!expected || !token || token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const batchSizeParam = new URL(request.url).searchParams.get("batch_size");
    const batchSize = batchSizeParam
      ? Math.min(Math.max(1, Number(batchSizeParam)), 2000)
      : 500;

    const result = await processOutboxBatch(batchSize);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("Outbox worker error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Worker failed" },
      { status: 500 },
    );
  }
}
