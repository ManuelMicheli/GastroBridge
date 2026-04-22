/* eslint-disable @typescript-eslint/no-explicit-any */
// `as any` sui select con view aggregate e RPC non ancora tipizzati.
import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  Euro,
  PackagePlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MagazzinoOverviewClient } from "./overview-client";
import {
  getStockOverview,
  getWarehousesForCurrentMember,
} from "@/lib/supplier/stock/queries";
import { formatCurrency } from "@/lib/utils/formatters";
import { SectionFrame } from "@/components/dashboard/supplier/_awwwards/section-frame";

export const metadata: Metadata = { title: "Giacenze — Magazzino" };

type SearchParams = Promise<{ warehouse?: string }>;

type TerminalKpiProps = {
  index: string;
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  tone?: "neutral" | "warn" | "danger" | "ok";
};

const toneClass: Record<NonNullable<TerminalKpiProps["tone"]>, string> = {
  neutral: "text-text-primary",
  warn: "text-accent-amber",
  danger: "text-accent-red",
  ok: "text-accent-green",
};

function TerminalKpi({
  index,
  label,
  value,
  hint,
  icon,
  tone = "neutral",
}: TerminalKpiProps) {
  return (
    <article
      className="group relative overflow-hidden rounded-xl border border-border-subtle bg-surface-card px-4 pt-3.5 pb-3 transition-colors hover:border-border-accent"
      style={{
        backgroundImage:
          "radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--color-text-tertiary) 14%, transparent) 1px, transparent 0)",
        backgroundSize: "14px 14px",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute right-2 top-2 h-2.5 w-2.5 border-r border-t border-border-subtle opacity-60 transition-[opacity,border-color] duration-200 group-hover:border-accent-green group-hover:opacity-100"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-2 left-2 h-2.5 w-2.5 border-b border-l border-border-subtle opacity-60 transition-[opacity,border-color] duration-200 group-hover:border-accent-green group-hover:opacity-100"
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-text-primary">
            <span className="text-text-tertiary/70 tabular-nums">{index}</span>
            <span aria-hidden className="text-border-subtle">
              ·
            </span>
            <span className="truncate">{label}</span>
          </span>
          <span
            className={`font-mono tabular-nums ${toneClass[tone]}`}
            style={{
              fontSize: "var(--text-display-lg, 28px)",
              lineHeight: "var(--text-display-lg--line-height, 32px)",
              letterSpacing: "var(--text-display-lg--letter-spacing, -0.011em)",
              fontWeight: 500,
            }}
          >
            {value}
          </span>
          {hint && (
            <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-tertiary">
              {hint}
            </span>
          )}
        </div>
        <div className="shrink-0 rounded-md border border-border-subtle bg-surface-base p-2 text-text-tertiary">
          {icon}
        </div>
      </div>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px scale-x-0 bg-gradient-to-r from-transparent via-accent-green to-transparent transition-transform duration-500 ease-out group-hover:scale-x-100"
      />
    </article>
  );
}

function TerminalError({ body }: { body: string }) {
  return (
    <div className="rounded-xl border border-accent-red/40 bg-accent-red/5 px-4 py-8 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent-red">
        {body}
      </p>
    </div>
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

  if (!user) return <TerminalError body="Sessione non valida" />;

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle<{ id: string }>();

  if (!supplier?.id) {
    return (
      <TerminalError body="Nessun profilo fornitore associato a questo utente" />
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
    <div className="flex flex-col gap-6">
      <header>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
            Magazzino · giacenze · lotti · sedi
          </span>
          <span aria-hidden className="h-px flex-1 bg-border-subtle" />
          <span className="inline-flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
            <span className="tabular-nums text-text-primary">
              {warehouses.length}
            </span>
            <span>sedi</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums text-text-primary">
              {productsWithStock}
            </span>
            <span>prodotti in stock</span>
          </span>
        </div>
        <h1
          className="mt-4 font-display"
          style={{
            fontSize: "var(--text-display-lg)",
            lineHeight: "var(--text-display-lg--line-height)",
            letterSpacing: "var(--text-display-lg--letter-spacing)",
            fontWeight: "var(--text-display-lg--font-weight)",
            color: "var(--color-text-primary)",
          }}
        >
          Magazzino
        </h1>
        <p className="mt-1.5 text-sm text-text-secondary">
          Panoramica stock per prodotto e sede. I valori sono espressi in unità
          base.
        </p>
      </header>

      {loadError ? (
        <TerminalError body={loadError} />
      ) : (
        <>
          <SectionFrame
            label="Stock · snapshot"
            trailing={warehouseId ? "sede filtrata" : "tutte le sedi"}
            padded={false}
          >
            <div
              className="grid gap-3 p-4"
              style={{
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
              }}
            >
              <TerminalKpi
                index="01"
                label="Prodotti in giacenza"
                value={productsWithStock.toLocaleString("it-IT")}
                hint={
                  warehouseId ? "nella sede selezionata" : "product/sede con stock"
                }
                icon={<Boxes className="h-4 w-4" aria-hidden />}
              />
              <TerminalKpi
                index="02"
                label="Lotti in scadenza 7gg"
                value={expiringLotsCount.toLocaleString("it-IT")}
                hint={
                  expiringLotsCount > 0
                    ? "controlla sezione lotti"
                    : "nessun lotto critico"
                }
                icon={<CalendarClock className="h-4 w-4" aria-hidden />}
                tone={expiringLotsCount > 0 ? "warn" : "neutral"}
              />
              <TerminalKpi
                index="03"
                label="Sotto scorta"
                value={lowStockCount.toLocaleString("it-IT")}
                hint={
                  lowStockCount > 0 ? "disponibile < soglia" : "tutto in regola"
                }
                icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
                tone={lowStockCount > 0 ? "danger" : "ok"}
              />
              <TerminalKpi
                index="04"
                label="Valore magazzino"
                value={formatCurrency(inventoryValue)}
                hint="Σ giacenza × costo unitario"
                icon={<Euro className="h-4 w-4" aria-hidden />}
              />
            </div>
          </SectionFrame>

          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-border-subtle bg-surface-card py-16 text-center">
              <PackagePlus
                className="h-7 w-7 text-text-tertiary"
                aria-hidden
              />
              <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
                Nessuna giacenza registrata
                {warehouseId ? " in questa sede" : ""}
              </p>
              <Link
                href="/supplier/magazzino/carichi/nuovo"
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent-green/40 bg-accent-green/10 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-green transition-colors hover:bg-accent-green/20"
              >
                <PackagePlus className="h-3.5 w-3.5" aria-hidden />
                Registra primo carico
              </Link>
            </div>
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
