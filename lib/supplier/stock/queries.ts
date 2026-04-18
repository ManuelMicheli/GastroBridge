/* eslint-disable @typescript-eslint/no-explicit-any */
// `as any` casts are required for RPC calls and for views (mv_stock_at_risk)
// that are not yet covered by the generated `Database` types.
import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database, StockMovementType } from "@/types/database";

type WarehouseRow = Database["public"]["Tables"]["warehouses"]["Row"];
type StockLotRow = Database["public"]["Tables"]["stock_lots"]["Row"];
type StockMovementRow = Database["public"]["Tables"]["stock_movements"]["Row"];

export type StockOverviewRow = {
  product_id: string;
  product_name: string;
  warehouse_id: string;
  warehouse_name: string;
  quantity_base: number;
  quantity_reserved_base: number;
  available_base: number;
  low_stock_threshold: number | null;
  is_low: boolean;
};

export type LotWithProduct = StockLotRow & {
  product_name: string;
  warehouse_name: string;
};

export type MovementRow = StockMovementRow & {
  product_name: string;
  warehouse_name: string;
  created_by_name: string | null;
  lot_code: string | null;
};

export type AtRiskLotRow = {
  supplier_id: string;
  product_id: string;
  warehouse_id: string;
  lot_id: string;
  lot_code: string;
  expiry_date: string;
  days_to_expiry: number;
  quantity_base: number;
  quantity_reserved_base: number;
  product_name?: string;
  warehouse_name?: string;
};

async function assertReadPermission(supplierId: string) {
  const supabase = await createClient();
  const { data } = await (supabase.rpc as any)("has_supplier_permission", {
    p_supplier_id: supplierId,
    p_permission: "stock.read",
  });
  if (!data) throw new Error("Permesso mancante: stock.read");
}

export async function getWarehousesForCurrentMember(
  supplierId: string,
): Promise<WarehouseRow[]> {
  await assertReadPermission(supplierId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("warehouses")
    .select("*")
    .eq("supplier_id", supplierId)
    .eq("is_active", true)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .returns<WarehouseRow[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getStockOverview(
  supplierId: string,
  warehouseId?: string,
): Promise<StockOverviewRow[]> {
  await assertReadPermission(supplierId);
  const supabase = await createClient();

  // Seleziona lotti attivi joinati a prodotto+magazzino dello stesso supplier.
  let q = (supabase as any)
    .from("stock_lots")
    .select(
      `
      product_id,
      warehouse_id,
      quantity_base,
      quantity_reserved_base,
      products:product_id ( id, name, low_stock_threshold, supplier_id ),
      warehouses:warehouse_id ( id, name, supplier_id )
      `,
    );
  if (warehouseId) q = q.eq("warehouse_id", warehouseId);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  type RawRow = {
    product_id: string;
    warehouse_id: string;
    quantity_base: number;
    quantity_reserved_base: number;
    products: {
      id: string;
      name: string;
      low_stock_threshold: number | null;
      supplier_id: string;
    } | null;
    warehouses: { id: string; name: string; supplier_id: string } | null;
  };

  const rows = (data ?? []) as RawRow[];
  const filtered = rows.filter(
    (r) =>
      r.products?.supplier_id === supplierId &&
      r.warehouses?.supplier_id === supplierId,
  );

  const byKey = new Map<string, StockOverviewRow>();
  for (const r of filtered) {
    const key = `${r.product_id}|${r.warehouse_id}`;
    const threshold = r.products?.low_stock_threshold ?? null;
    const existing = byKey.get(key);
    if (existing) {
      existing.quantity_base += Number(r.quantity_base);
      existing.quantity_reserved_base += Number(r.quantity_reserved_base);
      existing.available_base =
        existing.quantity_base - existing.quantity_reserved_base;
      existing.is_low =
        threshold !== null && existing.available_base < Number(threshold);
    } else {
      const qty = Number(r.quantity_base);
      const res = Number(r.quantity_reserved_base);
      const available = qty - res;
      byKey.set(key, {
        product_id: r.product_id,
        product_name: r.products?.name ?? "",
        warehouse_id: r.warehouse_id,
        warehouse_name: r.warehouses?.name ?? "",
        quantity_base: qty,
        quantity_reserved_base: res,
        available_base: available,
        low_stock_threshold: threshold,
        is_low: threshold !== null && available < Number(threshold),
      });
    }
  }

  return Array.from(byKey.values()).sort((a, b) =>
    a.product_name.localeCompare(b.product_name),
  );
}

export async function getLots(
  supplierId: string,
  opts: { warehouseId?: string; productId?: string; onlyWithStock?: boolean } = {},
): Promise<LotWithProduct[]> {
  await assertReadPermission(supplierId);
  const supabase = await createClient();

  let q = (supabase as any)
    .from("stock_lots")
    .select(
      `
      *,
      products:product_id ( id, name, supplier_id ),
      warehouses:warehouse_id ( id, name, supplier_id )
      `,
    )
    .order("expiry_date", { ascending: true, nullsFirst: false })
    .order("received_at", { ascending: true });

  if (opts.warehouseId) q = q.eq("warehouse_id", opts.warehouseId);
  if (opts.productId) q = q.eq("product_id", opts.productId);
  if (opts.onlyWithStock) q = q.gt("quantity_base", 0);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  type RawLot = StockLotRow & {
    products: { id: string; name: string; supplier_id: string } | null;
    warehouses: { id: string; name: string; supplier_id: string } | null;
  };

  const rows = (data ?? []) as RawLot[];
  return rows
    .filter(
      (r) =>
        r.products?.supplier_id === supplierId &&
        r.warehouses?.supplier_id === supplierId,
    )
    .map((r) => {
      const { products, warehouses, ...rest } = r;
      return {
        ...(rest as StockLotRow),
        product_name: products?.name ?? "",
        warehouse_name: warehouses?.name ?? "",
      };
    });
}

export async function getMovements(filter: {
  supplierId: string;
  warehouseId?: string;
  productId?: string;
  movementType?: StockMovementType;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<MovementRow[]> {
  await assertReadPermission(filter.supplierId);
  const supabase = await createClient();
  const limit = filter.limit ?? 100;

  let q = (supabase as any)
    .from("stock_movements")
    .select(
      `
      *,
      products:product_id ( id, name, supplier_id ),
      warehouses:warehouse_id ( id, name, supplier_id ),
      lot:lot_id ( id, lot_code ),
      member:created_by_member_id (
        id,
        profile:profile_id ( company_name )
      )
      `,
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filter.warehouseId) q = q.eq("warehouse_id", filter.warehouseId);
  if (filter.productId) q = q.eq("product_id", filter.productId);
  if (filter.movementType) q = q.eq("movement_type", filter.movementType);
  if (filter.from) q = q.gte("created_at", filter.from);
  if (filter.to) q = q.lte("created_at", filter.to);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  type RawMov = StockMovementRow & {
    products: { id: string; name: string; supplier_id: string } | null;
    warehouses: { id: string; name: string; supplier_id: string } | null;
    lot: { id: string; lot_code: string } | null;
    member: {
      id: string;
      profile: { company_name: string | null } | null;
    } | null;
  };

  const rows = (data ?? []) as RawMov[];
  return rows
    .filter(
      (r) =>
        r.products?.supplier_id === filter.supplierId &&
        r.warehouses?.supplier_id === filter.supplierId,
    )
    .map((r) => {
      const { products, warehouses, lot, member, ...rest } = r;
      return {
        ...(rest as StockMovementRow),
        product_name: products?.name ?? "",
        warehouse_name: warehouses?.name ?? "",
        created_by_name: member?.profile?.company_name ?? null,
        lot_code: lot?.lot_code ?? null,
      };
    });
}

/**
 * Restituisce gli ultimi N `cost_per_base` per prodotto+magazzino dai lotti
 * di tipo receive (ordinati dal piu recente al piu vecchio). Usato per il
 * check costo anomalo in `receiveLot`.
 */
export async function getCostHistory(
  productId: string,
  warehouseId: string,
  limit = 10,
): Promise<number[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_lots")
    .select("cost_per_base, received_at")
    .eq("product_id", productId)
    .eq("warehouse_id", warehouseId)
    .not("cost_per_base", "is", null)
    .order("received_at", { ascending: false })
    .limit(limit)
    .returns<Array<{ cost_per_base: number | null; received_at: string }>>();
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((r) => Number(r.cost_per_base))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export async function listAtRiskLots(
  supplierId: string,
): Promise<AtRiskLotRow[]> {
  await assertReadPermission(supplierId);
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("mv_stock_at_risk")
    .select("*")
    .eq("supplier_id", supplierId)
    .order("days_to_expiry", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AtRiskLotRow[];
}

/**
 * Conta prodotti sotto-scorta e lotti in scadenza entro `withinDays` giorni
 * per il supplier corrente. Swallow errors: in caso di fallimento restituisce
 * zeri in modo che la dashboard non vada in errore hard. Usata dal widget
 * "Alert magazzino" e dal badge in sidebar.
 */
export async function getStockAlertCounts(
  supplierId: string,
  withinDays = 7,
): Promise<{ lowStockCount: number; expiringCount: number }> {
  try {
    await assertReadPermission(supplierId);
  } catch {
    return { lowStockCount: 0, expiringCount: 0 };
  }
  const supabase = await createClient();

  // Low stock: aggrega per product_id sommando quantita disponibile, confronta
  // contro la soglia di prodotto.
  let lowStockCount = 0;
  try {
    const overview = await getStockOverview(supplierId);
    lowStockCount = overview.filter((r) => r.is_low).length;
  } catch {
    lowStockCount = 0;
  }

  // Expiring: conta distinct lot_id nella view mv_stock_at_risk con
  // days_to_expiry <= withinDays.
  let expiringCount = 0;
  try {
    const { data } = await (supabase as any)
      .from("mv_stock_at_risk")
      .select("lot_id, days_to_expiry")
      .eq("supplier_id", supplierId)
      .lte("days_to_expiry", withinDays);
    if (Array.isArray(data)) {
      expiringCount = new Set(
        (data as Array<{ lot_id: string }>).map((r) => r.lot_id),
      ).size;
    }
  } catch {
    expiringCount = 0;
  }

  return { lowStockCount, expiringCount };
}
