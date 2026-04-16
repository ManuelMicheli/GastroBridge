import { meilisearch, PRODUCTS_INDEX } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";

// ------------------------------------------------------------------
// Shapes
// ------------------------------------------------------------------

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  brand: string | null;
  unit: string;
  price: number;
  image_url: string | null;
  certifications: string[] | null;
  origin: string | null;
  is_available: boolean;
  is_featured: boolean;
  category_id: string;
  subcategory_id: string | null;
  supplier_id: string;
  suppliers: {
    id: string;
    company_name: string;
    city: string | null;
    rating_avg: number;
    is_verified: boolean;
  };
  categories: { name: string; slug: string };
  subcategories: { name: string; slug: string } | null;
};

type MeilisearchProductDoc = {
  id: string;
  name: string;
  description: string | null;
  brand: string | null;
  unit: string;
  price: number;
  image_url: string | null;
  certifications: string[] | null;
  origin: string | null;
  is_available: boolean;
  is_featured: boolean;
  category_id: string;
  category_name: string;
  category_slug: string;
  subcategory_id: string | null;
  subcategory_name: string | null;
  supplier_id: string;
  supplier_name: string;
  supplier_city: string | null;
  supplier_rating: number;
  supplier_verified: boolean;
};

function toMeilisearchDoc(p: ProductRow): MeilisearchProductDoc {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    brand: p.brand,
    unit: p.unit,
    price: p.price,
    image_url: p.image_url,
    certifications: p.certifications,
    origin: p.origin,
    is_available: p.is_available,
    is_featured: p.is_featured,
    category_id: p.category_id,
    category_name: p.categories.name,
    category_slug: p.categories.slug,
    subcategory_id: p.subcategory_id,
    subcategory_name: p.subcategories?.name ?? null,
    supplier_id: p.suppliers.id,
    supplier_name: p.suppliers.company_name,
    supplier_city: p.suppliers.city,
    supplier_rating: p.suppliers.rating_avg,
    supplier_verified: p.suppliers.is_verified,
  };
}

const SELECT_PRODUCT_JOIN = `
  id, name, description, brand, sku, unit, price,
  min_quantity, image_url, certifications, origin,
  is_available, is_featured, category_id, subcategory_id, supplier_id,
  suppliers!inner(id, company_name, city, rating_avg, is_verified),
  categories!inner(name, slug),
  subcategories(name, slug)
`;

// ------------------------------------------------------------------
// Full / incremental bulk sync
// ------------------------------------------------------------------

/**
 * Full or incremental product sync.
 *
 * When `productIds` is omitted, re-indexes every available product — use
 * sparingly (initial setup, disaster recovery). For per-mutation syncs
 * prefer `processOutboxBatch` via the cron worker.
 */
export async function syncProductsToMeilisearch(
  productIds?: string[],
): Promise<number> {
  const supabase = createAdminClient();

  let query = supabase.from("products").select(SELECT_PRODUCT_JOIN);
  if (productIds && productIds.length > 0) {
    query = query.in("id", productIds);
  } else {
    query = query.eq("is_available", true);
  }

  const { data, error } = await query.returns<ProductRow[]>();
  if (error) throw error;

  const documents = (data ?? []).map(toMeilisearchDoc);
  if (documents.length === 0) return 0;

  const index = meilisearch.index(PRODUCTS_INDEX);
  await index.addDocuments(documents);
  return documents.length;
}

export async function syncProductDelete(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const index = meilisearch.index(PRODUCTS_INDEX);
  await index.deleteDocuments(ids);
  return ids.length;
}

// ------------------------------------------------------------------
// Outbox worker
// ------------------------------------------------------------------

export type OutboxRow = {
  id: number;
  entity_type: string;
  entity_id: string;
  op: "upsert" | "delete";
  enqueued_at: string;
  attempts: number;
};

export type OutboxBatchResult = {
  scanned: number;
  upserted: number;
  deleted: number;
  failed: number;
};

/**
 * Drain up to `batchSize` pending rows from the outbox and apply to
 * Meilisearch. Coalesces by entity so later ops supersede earlier ones
 * within the batch. Single-writer assumption: safe only if invoked by
 * one cron worker at a time (2A: pg_cron every 30s).
 */
export async function processOutboxBatch(
  batchSize = 500,
): Promise<OutboxBatchResult> {
  const supabase = createAdminClient();
  const result: OutboxBatchResult = {
    scanned: 0,
    upserted: 0,
    deleted: 0,
    failed: 0,
  };

  const { data: rows, error } = await (supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        is: (col: string, val: null) => {
          order: (col: string, opts: { ascending: boolean }) => {
            limit: (n: number) => Promise<{ data: OutboxRow[] | null; error: unknown }>;
          };
        };
      };
    };
  })
    .from("meilisearch_sync_queue")
    .select("id,entity_type,entity_id,op,enqueued_at,attempts")
    .is("processed_at", null)
    .order("enqueued_at", { ascending: true })
    .limit(batchSize);

  if (error) throw error;
  const pending: OutboxRow[] = rows ?? [];
  result.scanned = pending.length;
  if (pending.length === 0) return result;

  // Coalesce: last op per entity wins.
  const byEntity = new Map<string, OutboxRow>();
  const rowIdsByKey = new Map<string, number[]>();
  for (const r of pending) {
    const key = `${r.entity_type}:${r.entity_id}`;
    byEntity.set(key, r);
    const list = rowIdsByKey.get(key) ?? [];
    list.push(r.id);
    rowIdsByKey.set(key, list);
  }

  const toUpsert: string[] = [];
  const toDelete: string[] = [];
  for (const r of byEntity.values()) {
    if (r.entity_type !== "product") continue;
    if (r.op === "delete") toDelete.push(r.entity_id);
    else toUpsert.push(r.entity_id);
  }

  const successfulRowIds: number[] = [];
  const failedRowIds: number[] = [];
  let lastError: string | null = null;

  try {
    if (toUpsert.length > 0) {
      const { data: products, error: prodErr } = await supabase
        .from("products")
        .select(SELECT_PRODUCT_JOIN)
        .in("id", toUpsert)
        .returns<ProductRow[]>();
      if (prodErr) throw prodErr;

      const presentIds = new Set((products ?? []).map((p) => p.id));
      const missingIds = toUpsert.filter((id) => !presentIds.has(id));

      if (products && products.length > 0) {
        await meilisearch
          .index(PRODUCTS_INDEX)
          .addDocuments(products.map(toMeilisearchDoc));
        result.upserted = products.length;
      }

      // Missing rows (deleted between enqueue and processing) → treat as delete.
      if (missingIds.length > 0) {
        await meilisearch.index(PRODUCTS_INDEX).deleteDocuments(missingIds);
        result.deleted += missingIds.length;
      }
    }
    if (toDelete.length > 0) {
      await meilisearch.index(PRODUCTS_INDEX).deleteDocuments(toDelete);
      result.deleted += toDelete.length;
    }

    // All coalesced keys processed; mark every underlying queue row as done.
    for (const ids of rowIdsByKey.values()) {
      successfulRowIds.push(...ids);
    }
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    for (const ids of rowIdsByKey.values()) {
      failedRowIds.push(...ids);
    }
    result.failed = failedRowIds.length;
  }

  const nowIso = new Date().toISOString();
  if (successfulRowIds.length > 0) {
    await (supabase as unknown as {
      from: (t: string) => {
        update: (patch: Record<string, unknown>) => {
          in: (col: string, vals: number[]) => Promise<{ error: unknown }>;
        };
      };
    })
      .from("meilisearch_sync_queue")
      .update({ processed_at: nowIso })
      .in("id", successfulRowIds);
  }
  if (failedRowIds.length > 0 && lastError) {
    // Bump attempts + store last_error. Fetch current attempts first,
    // then write back +1. Small batch so sequential is fine.
    const { data: current } = await (supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          in: (col: string, vals: number[]) => Promise<{
            data: { id: number; attempts: number }[] | null;
            error: unknown;
          }>;
        };
      };
    })
      .from("meilisearch_sync_queue")
      .select("id,attempts")
      .in("id", failedRowIds);
    for (const row of current ?? []) {
      await (supabase as unknown as {
        from: (t: string) => {
          update: (patch: Record<string, unknown>) => {
            eq: (col: string, val: number) => Promise<{ error: unknown }>;
          };
        };
      })
        .from("meilisearch_sync_queue")
        .update({ attempts: row.attempts + 1, last_error: lastError })
        .eq("id", row.id);
    }
  }

  return result;
}

// ------------------------------------------------------------------
// Index setup (filterable/sortable/searchable) — unchanged.
// ------------------------------------------------------------------

export async function setupMeilisearchIndex() {
  const index = meilisearch.index(PRODUCTS_INDEX);

  await index.updateFilterableAttributes([
    "category_id",
    "subcategory_id",
    "supplier_id",
    "unit",
    "certifications",
    "supplier_verified",
    "is_featured",
    "is_available",
    "price",
  ]);

  await index.updateSortableAttributes([
    "price",
    "supplier_rating",
    "name",
  ]);

  await index.updateSearchableAttributes([
    "name",
    "brand",
    "description",
    "category_name",
    "subcategory_name",
    "supplier_name",
    "origin",
    "certifications",
  ]);
}
