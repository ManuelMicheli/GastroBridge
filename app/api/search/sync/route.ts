import { NextResponse } from "next/server";
import { syncProductsToMeilisearch, setupMeilisearchIndex } from "@/lib/meilisearch/sync";

export async function POST() {
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
