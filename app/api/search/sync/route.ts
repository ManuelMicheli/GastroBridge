import { NextResponse } from "next/server";
import { syncProductsToMeilisearch, setupMeilisearchIndex } from "@/lib/meilisearch/sync";
import { safeEqual } from "@/lib/utils/safe-equal";

export async function POST(request: Request) {
  const token = request.headers.get("x-cron-token") ?? "";
  const expected = process.env.CRON_SECRET;
  if (!expected || !safeEqual(token, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await setupMeilisearchIndex();
    const count = await syncProductsToMeilisearch();
    return NextResponse.json({ success: true, synced: count });
  } catch (error) {
    console.error("Meilisearch sync error:", error);
    return NextResponse.json(
      { error: "Sync failed" },
      { status: 500 }
    );
  }
}
