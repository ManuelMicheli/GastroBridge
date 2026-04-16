import { NextResponse } from "next/server";
import { meilisearch, PRODUCTS_INDEX } from "@/lib/meilisearch/client";
import { createClient } from "@/lib/supabase/server";

// Thin authenticated proxy over Meilisearch. Keeps MEILISEARCH_API_KEY
// server-only and enforces supplier membership for admin-scoped lookups.
//
// Query params:
//   q            string   — full-text query
//   supplier_id  uuid     — scope to one supplier
//   category_id  uuid     — filter
//   limit        number   — default 50, max 200
//   offset       number   — default 0
//   mode         "admin" | "public"   — default "public"
//
// mode=admin:   requires authenticated user + is_supplier_member(supplier_id),
//               returns all products including unavailable.
// mode=public:  forces is_available=true filter. Accessible to anon.

const MAX_LIMIT = 200;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const supplierId = url.searchParams.get("supplier_id");
  const categoryId = url.searchParams.get("category_id");
  const mode = (url.searchParams.get("mode") ?? "public") as "admin" | "public";
  const limit = Math.min(
    Math.max(1, Number(url.searchParams.get("limit") ?? 50)),
    MAX_LIMIT,
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));

  if (mode !== "admin" && mode !== "public") {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  // Build Meilisearch filter expression.
  const filters: string[] = [];
  if (supplierId) filters.push(`supplier_id = "${supplierId}"`);
  if (categoryId) filters.push(`category_id = "${categoryId}"`);

  if (mode === "public") {
    filters.push("is_available = true");
  } else {
    // mode === "admin" — require membership on the requested supplier.
    if (!supplierId) {
      return NextResponse.json(
        { error: "supplier_id required for admin mode" },
        { status: 400 },
      );
    }
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: isMember } = await (
      supabase.rpc as unknown as (
        fn: "is_supplier_member",
        args: { p_supplier_id: string },
      ) => Promise<{ data: boolean | null; error: unknown }>
    )("is_supplier_member", { p_supplier_id: supplierId });
    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const result = await meilisearch.index(PRODUCTS_INDEX).search(q, {
      limit,
      offset,
      filter: filters.length > 0 ? filters.join(" AND ") : undefined,
    });
    return NextResponse.json({
      hits: result.hits,
      estimatedTotalHits: result.estimatedTotalHits,
      limit: result.limit,
      offset: result.offset,
      processingTimeMs: result.processingTimeMs,
    });
  } catch (err) {
    console.error("Meilisearch proxy error:", err);
    return NextResponse.json(
      { error: "Search unavailable" },
      { status: 503 },
    );
  }
}
