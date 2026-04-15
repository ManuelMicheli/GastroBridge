/* eslint-disable @typescript-eslint/no-explicit-any */
// `as any` casts sono necessari per le chiamate RPC verso le helper
// transazionali (`receive_lot_tx`, `adjust_stock_tx`) non ancora coperte dai
// tipi generati di Supabase.
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveSupplierMember, requirePermission } from "@/lib/supplier/context";
import { allocateFefo } from "./fefo";
import type { LotCandidate } from "./types";
import {
  AdjustStockSchema,
  ListLotsFilterSchema,
  ListMovementsFilterSchema,
  ReceiveLotSchema,
  type AdjustStockInput,
  type ListLotsFilter,
  type ListMovementsFilter,
  type ReceiveLotInput,
} from "./schemas";
import {
  getCostHistory,
  getLots,
  getMovements,
  getStockOverview,
  getWarehousesForCurrentMember,
  listAtRiskLots,
  type AtRiskLotRow,
  type LotWithProduct,
  type MovementRow,
  type StockOverviewRow,
} from "./queries";
import type { Database } from "@/types/database";

type WarehouseRow = Database["public"]["Tables"]["warehouses"]["Row"];

type Result<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const COST_ANOMALY_THRESHOLD = 0.15;

function revalidateAll() {
  revalidatePath("/supplier/magazzino");
  revalidatePath("/supplier/magazzino/carichi");
  revalidatePath("/supplier/magazzino/inventario");
  revalidatePath("/supplier/magazzino/movimenti");
  revalidatePath("/supplier/magazzino/scadenze");
  revalidatePath("/supplier/dashboard");
}

function errMsg(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

// ---------------------------------------------------------------------------
// Letture esposte come server action (thin wrapper sulle queries.ts)
// ---------------------------------------------------------------------------

export async function listWarehousesForStock(
  supplierId: string,
): Promise<Result<WarehouseRow[]>> {
  try {
    const data = await getWarehousesForCurrentMember(supplierId);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: errMsg(err, "Errore caricamento sedi") };
  }
}

export async function listStockOverview(
  supplierId: string,
  warehouseId?: string,
): Promise<Result<StockOverviewRow[]>> {
  try {
    const data = await getStockOverview(supplierId, warehouseId);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: errMsg(err, "Errore caricamento stock") };
  }
}

export async function listLots(
  input: ListLotsFilter,
): Promise<Result<LotWithProduct[]>> {
  try {
    const parsed = ListLotsFilterSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Filtri non validi",
      };
    }
    const { supplierId, ...rest } = parsed.data;
    const data = await getLots(supplierId, rest);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: errMsg(err, "Errore caricamento lotti") };
  }
}

export async function listMovements(
  input: ListMovementsFilter,
): Promise<Result<MovementRow[]>> {
  try {
    const parsed = ListMovementsFilterSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Filtri non validi",
      };
    }
    const data = await getMovements(parsed.data);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: errMsg(err, "Errore caricamento movimenti") };
  }
}

export async function listAtRisk(
  supplierId: string,
): Promise<Result<AtRiskLotRow[]>> {
  try {
    const data = await listAtRiskLots(supplierId);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: errMsg(err, "Errore caricamento alert") };
  }
}

// ---------------------------------------------------------------------------
// receiveLot — carico lotto via RPC transazionale
// ---------------------------------------------------------------------------

export async function receiveLot(
  input: ReceiveLotInput,
): Promise<Result<{ lotId: string; warning?: "costo_anomalo" }>> {
  try {
    const parsed = ReceiveLotSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dati carico non validi",
      };
    }
    const data = parsed.data;

    await requirePermission(data.supplierId, "stock.receive");

    const supabase = await createClient();
    const member = (await getActiveSupplierMember(data.supplierId)) as
      | { id: string; role: string; supplier_id: string }
      | null;
    if (!member) {
      return { ok: false, error: "Membro fornitore non trovato" };
    }

    // Fetch product_sales_units per la conversione in unita base.
    const { data: psu, error: psuErr } = await (supabase as any)
      .from("product_sales_units")
      .select("id, product_id, conversion_to_base, is_active")
      .eq("id", data.salesUnitId)
      .maybeSingle();
    if (psuErr) return { ok: false, error: psuErr.message };
    if (!psu) return { ok: false, error: "Unita di vendita non trovata" };
    if (psu.product_id !== data.productId) {
      return { ok: false, error: "Unita non appartiene al prodotto" };
    }
    if (psu.is_active === false) {
      return { ok: false, error: "Unita di vendita non attiva" };
    }

    const conversion = Number(psu.conversion_to_base);
    if (!Number.isFinite(conversion) || conversion <= 0) {
      return { ok: false, error: "Conversione unita non valida" };
    }
    const quantityBase = data.quantitySalesUnit * conversion;
    if (!Number.isFinite(quantityBase) || quantityBase <= 0) {
      return { ok: false, error: "Quantita carico non valida" };
    }

    // Verifica supplier ownership del magazzino (difesa in profondita' oltre RLS).
    const { data: wh, error: whErr } = await supabase
      .from("warehouses")
      .select("id, supplier_id, is_active")
      .eq("id", data.warehouseId)
      .maybeSingle<{ id: string; supplier_id: string; is_active: boolean }>();
    if (whErr) return { ok: false, error: whErr.message };
    if (!wh || wh.supplier_id !== data.supplierId) {
      return { ok: false, error: "Magazzino non valido" };
    }
    if (!wh.is_active) {
      return { ok: false, error: "Magazzino non attivo" };
    }

    // Check costo anomalo (warning, non blocca).
    let warning: "costo_anomalo" | undefined;
    if (data.costPerBase !== null && data.costPerBase > 0) {
      const history = await getCostHistory(data.productId, data.warehouseId, 10);
      if (history.length > 0) {
        const avg =
          history.reduce((sum, n) => sum + n, 0) / history.length;
        if (avg > 0) {
          const delta = Math.abs(data.costPerBase - avg) / avg;
          if (delta > COST_ANOMALY_THRESHOLD) warning = "costo_anomalo";
        }
      }
    }

    // Transazione via RPC.
    const { data: lotId, error: rpcErr } = await (supabase.rpc as any)(
      "receive_lot_tx",
      {
        p_product_id: data.productId,
        p_warehouse_id: data.warehouseId,
        p_lot_code: data.lotCode.trim(),
        p_expiry_date: data.expiryDate,
        p_quantity_base: quantityBase,
        p_cost_per_base: data.costPerBase,
        p_member_id: member.id,
        p_notes: data.notes ?? null,
      },
    );
    if (rpcErr || !lotId) {
      return { ok: false, error: rpcErr?.message ?? "Errore carico lotto" };
    }

    // Refresh vista materializzata alert (best-effort, errori non bloccanti).
    await (supabase.rpc as any)("refresh_mv_stock_at_risk").catch(() => {});

    revalidateAll();
    return {
      ok: true,
      data: warning ? { lotId: lotId as string, warning } : { lotId: lotId as string },
    };
  } catch (err) {
    return { ok: false, error: errMsg(err, "Errore carico lotto") };
  }
}

// ---------------------------------------------------------------------------
// adjustStock — rettifica (delta positivo o negativo, FEFO se lotId null)
// ---------------------------------------------------------------------------

export async function adjustStock(
  input: AdjustStockInput,
): Promise<Result<{ movementIds: string[] }>> {
  try {
    const parsed = AdjustStockSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dati rettifica non validi",
      };
    }
    const data = parsed.data;

    await requirePermission(data.supplierId, "stock.adjust");

    const supabase = await createClient();
    const member = (await getActiveSupplierMember(data.supplierId)) as
      | { id: string; role: string; supplier_id: string }
      | null;
    if (!member) {
      return { ok: false, error: "Membro fornitore non trovato" };
    }

    // Difesa in profondita' sul magazzino.
    const { data: wh, error: whErr } = await supabase
      .from("warehouses")
      .select("id, supplier_id, is_active")
      .eq("id", data.warehouseId)
      .maybeSingle<{ id: string; supplier_id: string; is_active: boolean }>();
    if (whErr) return { ok: false, error: whErr.message };
    if (!wh || wh.supplier_id !== data.supplierId) {
      return { ok: false, error: "Magazzino non valido" };
    }
    if (!wh.is_active) {
      return { ok: false, error: "Magazzino non attivo" };
    }

    const movementIds: string[] = [];

    // Caso 1: delta positivo o delta negativo con lotId specificato → una sola chiamata RPC.
    if (data.deltaBase > 0 || data.lotId !== null) {
      const { data: movId, error: rpcErr } = await (supabase.rpc as any)(
        "adjust_stock_tx",
        {
          p_product_id: data.productId,
          p_warehouse_id: data.warehouseId,
          p_lot_id: data.lotId,
          p_delta_base: data.deltaBase,
          p_reason: data.reason,
          p_member_id: member.id,
        },
      );
      if (rpcErr || !movId) {
        return { ok: false, error: rpcErr?.message ?? "Errore rettifica" };
      }
      movementIds.push(movId as string);
    } else {
      // Caso 2: delta negativo senza lotId → FEFO sui lotti disponibili.
      const lots = await getLots(data.supplierId, {
        warehouseId: data.warehouseId,
        productId: data.productId,
        onlyWithStock: true,
      });
      const candidates: LotCandidate[] = lots.map((l) => ({
        id: l.id,
        productId: l.product_id,
        warehouseId: l.warehouse_id,
        lotCode: l.lot_code,
        expiryDate: l.expiry_date,
        receivedAt: l.received_at,
        quantityBase: Number(l.quantity_base),
        quantityReservedBase: Number(l.quantity_reserved_base),
      }));
      const requested = Math.abs(data.deltaBase);
      const allocation = allocateFefo(candidates, requested);
      if (!allocation.ok) {
        return {
          ok: false,
          error: `Stock insufficiente: mancano ${allocation.shortBy} unita base`,
        };
      }
      for (const alloc of allocation.allocations) {
        const { data: movId, error: rpcErr } = await (supabase.rpc as any)(
          "adjust_stock_tx",
          {
            p_product_id: data.productId,
            p_warehouse_id: data.warehouseId,
            p_lot_id: alloc.lotId,
            p_delta_base: -alloc.quantityBase,
            p_reason: data.reason,
            p_member_id: member.id,
          },
        );
        if (rpcErr || !movId) {
          return {
            ok: false,
            error: rpcErr?.message ?? "Errore rettifica FEFO (parziale)",
          };
        }
        movementIds.push(movId as string);
      }
    }

    await (supabase.rpc as any)("refresh_mv_stock_at_risk").catch(() => {});

    revalidateAll();
    return { ok: true, data: { movementIds } };
  } catch (err) {
    return { ok: false, error: errMsg(err, "Errore rettifica") };
  }
}
