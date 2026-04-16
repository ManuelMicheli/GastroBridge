import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ProductListSort =
  | "created_desc"
  | "name_asc"
  | "price_asc"
  | "price_desc";

export type ProductListFilters = {
  q?: string;
  category_id?: string;
  is_available?: boolean;
  quality_tier?: string;
  is_bio?: boolean;
};

export type ProductListItem = {
  id: string;
  name: string;
  brand: string | null;
  unit: string;
  price: number;
  is_available: boolean;
  is_featured: boolean;
  image_url: string | null;
  sku: string | null;
  category_id: string | null;
  quality_tier: string | null;
  is_bio: boolean | null;
  created_at: string;
};

// Opaque cursor: base64url of {s: sort, v: sort_value, i: id}.
export type ProductListCursor = {
  s: ProductListSort;
  v: string | number;
  i: string;
};

const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 200;

const PRODUCT_COLUMNS =
  "id,name,brand,unit,price,is_available,is_featured,image_url,sku,category_id,quality_tier,is_bio,created_at";

function encodeCursor(c: ProductListCursor): string {
  const json = JSON.stringify(c);
  return Buffer.from(json, "utf8").toString("base64url");
}

function decodeCursor(raw: string): ProductListCursor | null {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as ProductListCursor;
    if (!parsed.s || parsed.v === undefined || !parsed.i) return null;
    return parsed;
  } catch {
    return null;
  }
}

type ListArgs = {
  supplierId: string;
  cursor?: string;
  pageSize?: number;
  search?: string;
  filters?: ProductListFilters;
  sort?: ProductListSort;
};

type ListResult = {
  items: ProductListItem[];
  nextCursor: string | null;
};

export async function listProductsForSupplier(
  args: ListArgs,
): Promise<ListResult> {
  const {
    supplierId,
    cursor,
    search,
    filters = {},
    sort = "created_desc",
  } = args;
  const pageSize = Math.min(
    Math.max(1, args.pageSize ?? PAGE_SIZE_DEFAULT),
    PAGE_SIZE_MAX,
  );

  const supabase = await createClient();
  let q = supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("supplier_id", supplierId);

  // Filters
  if (filters.category_id) q = q.eq("category_id", filters.category_id);
  if (typeof filters.is_available === "boolean")
    q = q.eq("is_available", filters.is_available);
  if (filters.quality_tier) q = q.eq("quality_tier", filters.quality_tier);
  if (typeof filters.is_bio === "boolean") q = q.eq("is_bio", filters.is_bio);

  // Search (FTS fallback; client uses Meilisearch via route handler).
  const searchText = (search ?? filters.q ?? "").trim();
  if (searchText) {
    // textSearch targets the search_tsv generated column.
    q = q.textSearch("search_tsv", searchText, {
      type: "plain",
      config: "italian",
    });
  }

  // Cursor (keyset) + sort
  const parsedCursor = cursor ? decodeCursor(cursor) : null;
  const applyKeyset = parsedCursor && parsedCursor.s === sort;

  switch (sort) {
    case "created_desc":
      if (applyKeyset) {
        // (created_at, id) < (cv, ci) — descending.
        const cv = parsedCursor!.v as string;
        const ci = parsedCursor!.i;
        q = q.or(
          `created_at.lt.${cv},and(created_at.eq.${cv},id.lt.${ci})`,
        );
      }
      q = q
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
      break;
    case "name_asc":
      if (applyKeyset) {
        const cv = String(parsedCursor!.v).replace(/"/g, '""');
        const ci = parsedCursor!.i;
        q = q.or(`name.gt."${cv}",and(name.eq."${cv}",id.gt.${ci})`);
      }
      q = q
        .order("name", { ascending: true })
        .order("id", { ascending: true });
      break;
    case "price_asc":
      if (applyKeyset) {
        const cv = parsedCursor!.v as number;
        const ci = parsedCursor!.i;
        q = q.or(`price.gt.${cv},and(price.eq.${cv},id.gt.${ci})`);
      }
      q = q
        .order("price", { ascending: true })
        .order("id", { ascending: true });
      break;
    case "price_desc":
      if (applyKeyset) {
        const cv = parsedCursor!.v as number;
        const ci = parsedCursor!.i;
        q = q.or(`price.lt.${cv},and(price.eq.${cv},id.lt.${ci})`);
      }
      q = q
        .order("price", { ascending: false })
        .order("id", { ascending: false });
      break;
  }

  q = q.limit(pageSize + 1);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as ProductListItem[];
  const hasMore = rows.length > pageSize;
  const items = hasMore ? rows.slice(0, pageSize) : rows;

  let nextCursor: string | null = null;
  if (hasMore) {
    const last = items[items.length - 1]!;
    const v: string | number =
      sort === "created_desc"
        ? last.created_at
        : sort === "name_asc"
          ? last.name
          : last.price;
    nextCursor = encodeCursor({ s: sort, v, i: last.id });
  }

  return { items, nextCursor };
}

// ------------------------------------------------------------------
// Catalog summary (reads MV)
// ------------------------------------------------------------------

export type SupplierCatalogSummary = {
  total: number;
  available: number;
  categories: number;
  priceMin: number | null;
  priceMax: number | null;
};

export async function getSupplierCatalogSummary(
  supplierId: string,
): Promise<SupplierCatalogSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mv_supplier_catalog_summary")
    .select(
      "total_products,available_products,category_count,price_min,price_max",
    )
    .eq("supplier_id", supplierId)
    .maybeSingle<{
      total_products: number;
      available_products: number;
      category_count: number;
      price_min: number | null;
      price_max: number | null;
    }>();
  if (error) throw new Error(error.message);
  if (!data) {
    return {
      total: 0,
      available: 0,
      categories: 0,
      priceMin: null,
      priceMax: null,
    };
  }
  return {
    total: data.total_products,
    available: data.available_products,
    categories: data.category_count,
    priceMin: data.price_min,
    priceMax: data.price_max,
  };
}
