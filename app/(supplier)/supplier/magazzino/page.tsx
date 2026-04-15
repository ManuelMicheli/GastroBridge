/* eslint-disable @typescript-eslint/no-explicit-any */
// `as any` sui select con view aggregate e RPC non ancora tipizzati.
import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Boxes, CalendarClock, Euro, PackagePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { MagazzinoOverviewClient } from "./overview-client";
import {
  getStockOverview,
  getWarehousesForCurrentMember,
} from "@/lib/supplier/stock/queries";
import { formatCurrency } from "@/lib/utils/formatters";

export const metadata: Metadata = { title: "Giacenze — Magazzino" };

type SearchParams = Promise<{ warehouse?: string }>;

type KpiCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  tone?: "neutral" | "warn" | "danger" | "ok";
};

const toneClass: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  neutral: "text-text-primary",
  warn: "text-accent-amber",
  danger: "text-accent-red",
  ok: "text-accent-green",
};

function KpiCard({ label, value, hint, icon, tone = "neutral" }: KpiCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
            {label}
          </p>
          <p className={`mt-2 text-2xl font-semibold tabular-nums ${toneClass[tone]}`}>
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-text-secondary">{hint}</p>}
        </div>
        <div className="shrink-0 rounded-lg bg-surface-base p-2 text-text-secondary">
          {icon}
        </div>
      </div>
    </Card>
  );
}

export default async function MagazzinoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const warehouseId = params.warehouse?.trim() || undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Card className="text-center py-16">
        <p className="text-text-secondary">Sessione non valida.</p>
      </Card>
    );
  }

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle<{ id: string }>();

  if (!supplier?.id) {
    return (
      <Card className="text-center py-16">
        <p className="text-text-secondary">
          Nessun profilo fornitore associato a questo utente.
        </p>
      </Card>
    );
  }

  const supplierId = supplier.id;

  let items: Awaited<ReturnType<typeof getStockOverview>> = [];
  let warehouses: Awaited<ReturnType<typeof getWarehousesForCurrentMember>> = [];
  let loadError: string | null = null;

  try {
    [items, warehouses] = await Promise.all([
      getStockOverview(supplierId, warehouseId),
      getWarehousesForCurrentMember(supplierId),
    ]);
  } catch (err) {
    loadError =
      err instanceof Error ? err.message : "Errore caricamento giacenze";
  }

  // Valore magazzino e conteggio lotti in scadenza 7gg: interroghiamo i
  // lotti filtrati per warehouse (se presente) e supplier via join prodotto.
  let inventoryValue = 0;
  let expiringLotsCount = 0;

  if (!loadError) {
    let lotsQ = (supabase as any)
      .from("stock_lots")
      .select(
        `
        quantity_base,
        cost_per_base,
        expiry_date,
        products:product_id ( supplier_id ),
        warehouses:warehouse_id ( supplier_id )
        `,
      )
      .gt("quantity_base", 0);
    if (warehouseId) lotsQ = lotsQ.eq("warehouse_id", warehouseId);

    const { data: lotsRaw, error: lotsErr } = await lotsQ;
    if (!lotsErr && Array.isArray(lotsRaw)) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAhead = new Date(today);
      weekAhead.setDate(weekAhead.getDate() + 7);

      for (const row of lotsRaw as Array<{
        quantity_base: number | null;
        cost_per_base: number | null;
        expiry_date: string | null;
        products: { supplier_id: string } | null;
        warehouses: { supplier_id: string } | null;
      }>) {
        if (
          row.products?.supplier_id !== supplierId ||
          row.warehouses?.supplier_id !== supplierId
        ) {
          continue;
        }
        const qty = Number(row.quantity_base ?? 0);
        const cost = Number(row.cost_per_base ?? 0);
        if (Number.isFinite(qty) && Number.isFinite(cost)) {
          inventoryValue += qty * cost;
        }
        if (row.expiry_date) {
          const exp = new Date(row.expiry_date);
          if (exp >= today && exp <= weekAhead) expiringLotsCount++;
        }
      }
    }
  }

  const productsWithStock = new Set(
    items.filter((i) => i.quantity_base > 0).map((i) => i.product_id),
  ).size;
  const lowStockCount = items.filter((i) => i.is_low).length;

  const hideWarehouseColumn = !!warehouseId || warehouses.length <= 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-text-primary">Giacenze</h1>
        <p className="text-sm text-text-secondary">
          Panoramica stock per prodotto e sede. I valori sono espressi in unità
          base.
        </p>
      </div>

      {loadError ? (
        <Card className="py-10 text-center">
          <p className="text-sm text-accent-red">{loadError}</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Prodotti in giacenza"
              value={String(productsWithStock)}
              hint={
                warehouseId
                  ? "Nella sede selezionata"
                  : "Distinct product/sede con stock"
              }
              icon={<Boxes className="h-5 w-5" aria-hidden />}
            />
            <KpiCard
              label="Lotti in scadenza 7gg"
              value={String(expiringLotsCount)}
              hint={expiringLotsCount > 0 ? "Controlla sezione Lotti" : "Nessun lotto critico"}
              icon={<CalendarClock className="h-5 w-5" aria-hidden />}
              tone={expiringLotsCount > 0 ? "warn" : "neutral"}
            />
            <KpiCard
              label="Prodotti sotto scorta"
              value={String(lowStockCount)}
              hint={
                lowStockCount > 0 ? "Disponibile < soglia" : "Tutto in regola"
              }
              icon={<AlertTriangle className="h-5 w-5" aria-hidden />}
              tone={lowStockCount > 0 ? "danger" : "ok"}
            />
            <KpiCard
              label="Valore magazzino"
              value={formatCurrency(inventoryValue)}
              hint="Σ giacenza × costo unitario"
              icon={<Euro className="h-5 w-5" aria-hidden />}
            />
          </div>

          {items.length === 0 ? (
            <Card className="flex flex-col items-center gap-3 py-16 text-center">
              <PackagePlus className="h-10 w-10 text-text-secondary" aria-hidden />
              <p className="text-text-secondary">
                Nessuna giacenza registrata
                {warehouseId ? " in questa sede" : ""}.
              </p>
              <Link
                href="/supplier/magazzino/carichi/nuovo"
                className="inline-flex items-center gap-2 rounded-md bg-accent-green px-3 py-1.5 text-sm font-medium text-charcoal hover:bg-accent-green/90"
              >
                <PackagePlus className="h-4 w-4" aria-hidden />
                Registra primo carico
              </Link>
            </Card>
          ) : (
            <MagazzinoOverviewClient
              items={items}
              hideWarehouseColumn={hideWarehouseColumn}
            />
          )}
        </>
      )}
    </div>
  );
}
