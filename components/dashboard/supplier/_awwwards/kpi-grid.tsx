// components/dashboard/supplier/_awwwards/kpi-grid.tsx
//
// Monthly summary grid for the supplier dashboard. Two typographic groups:
//   01 · ORDINI     — Ricevuti oggi / Backlog / Clienti attivi / Prodotti
//   02 · FATTURATO  — Mese / Ticket medio / Delta 14gg vs prec.
// Cells reuse TerminalKPICard (count-up, delta chip, sparkline, corner
// brackets, scan-line hover). Group headers are pure typography — no
// coloured chips — to keep the terminal aesthetic restrained.

"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { TerminalKPICard } from "@/components/dashboard/cards/terminal-kpi-card";
import { formatCurrency } from "@/lib/utils/formatters";

export type SupplierKpiGridProps = {
  ordersToday: number;
  orderBacklogCount: number;
  orderBacklogOldestHours: number;
  activeClients: number;
  activeProducts: number;
  monthlyRevenue: number;
  prevRevenue: number;
  revenueSparkline: number[];
  avgTicket: number | null;
  avgTicketPrev: number | null;
  revenueYoYDeltaPct: number | null;
};

/**
 * Typographic group header. Big faded index → bold label → muted subtitle
 * on one line, divided from the cells below by a hairline rule with a small
 * tick cap on each end. Optional `right` accessory sits flush-right.
 */
function GroupHeader({
  index,
  label,
  subtitle,
  accent,
  right,
}: {
  index: string;
  label: string;
  subtitle: string;
  accent: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-4 flex-wrap">
        <span
          aria-hidden
          className="font-mono tabular-nums leading-none select-none"
          style={{
            fontSize: "30px",
            fontWeight: 300,
            letterSpacing: "-0.02em",
            color: `color-mix(in srgb, ${accent} 70%, transparent)`,
          }}
        >
          {index}
        </span>
        <div className="flex flex-col gap-0.5 min-w-0">
          <span
            className="font-mono text-[11px] uppercase tracking-[0.18em]"
            style={{ color: accent }}
          >
            {label}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary truncate">
            {subtitle}
          </span>
        </div>
        <span aria-hidden className="flex-1 min-w-[24px]" />
        {right ? (
          <span className="flex items-center gap-2 pb-0.5">{right}</span>
        ) : null}
      </div>
      <div className="relative">
        <span
          aria-hidden
          className="block h-px w-full"
          style={{
            background: `linear-gradient(90deg, color-mix(in srgb, ${accent} 55%, transparent) 0%, color-mix(in srgb, ${accent} 18%, transparent) 12%, var(--color-border-subtle) 32%, var(--color-border-subtle) 100%)`,
          }}
        />
        <span
          aria-hidden
          className="absolute left-0 -top-[3px] block h-[7px] w-px"
          style={{ backgroundColor: accent }}
        />
        <span
          aria-hidden
          className="absolute right-0 -top-[3px] block h-[7px] w-px bg-border-subtle"
        />
      </div>
    </div>
  );
}

export function SupplierKpiGrid({
  ordersToday,
  orderBacklogCount,
  orderBacklogOldestHours,
  activeClients,
  activeProducts,
  monthlyRevenue,
  prevRevenue,
  revenueSparkline,
  avgTicket,
  avgTicketPrev,
  revenueYoYDeltaPct,
}: SupplierKpiGridProps) {
  const backlogHint =
    orderBacklogCount > 0 && orderBacklogOldestHours > 0
      ? `oldest · ${orderBacklogOldestHours}h`
      : "da evadere";

  const yoyLabel =
    revenueYoYDeltaPct === null
      ? null
      : `${revenueYoYDeltaPct >= 0 ? "+" : ""}${revenueYoYDeltaPct.toFixed(1)}%`;
  const yoyPositive = revenueYoYDeltaPct !== null && revenueYoYDeltaPct >= 0;

  return (
    <div className="flex flex-col gap-7">
      {/* ── 01 · Ordini ─────────────────────────────────────────────────── */}
      <section aria-labelledby="supplier-kpi-group-ordini" className="flex flex-col gap-4">
        <GroupHeader
          index="01"
          label="Ordini"
          subtitle="Oggi · backlog · anagrafica"
          accent="var(--color-accent-amber)"
          right={
            <Link
              href="/supplier/ordini"
              className="group inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary hover:text-accent-amber transition-colors"
            >
              <span>Ordini</span>
              <ArrowUpRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          }
        />
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(200px, 100%), 1fr))",
          }}
        >
          <TerminalKPICard
            index="01"
            label="Ricevuti oggi"
            value={ordersToday.toLocaleString("it-IT")}
            numericValue={ordersToday}
            hint="nuovi split"
          />
          <TerminalKPICard
            index="02"
            label="Backlog"
            value={orderBacklogCount.toLocaleString("it-IT")}
            numericValue={orderBacklogCount}
            positiveIsGood={false}
            hint={backlogHint}
          />
          <TerminalKPICard
            index="03"
            label="Clienti attivi"
            value={activeClients.toLocaleString("it-IT")}
            numericValue={activeClients}
            hint="ristoranti collegati"
          />
          <TerminalKPICard
            index="04"
            label="Prodotti attivi"
            value={activeProducts.toLocaleString("it-IT")}
            numericValue={activeProducts}
            hint="in catalogo"
          />
        </div>
      </section>

      {/* ── 02 · Fatturato ──────────────────────────────────────────────── */}
      <section aria-labelledby="supplier-kpi-group-fatturato" className="flex flex-col gap-4">
        <GroupHeader
          index="02"
          label="Fatturato"
          subtitle="Ultimi 30 giorni · da splits confermati"
          accent="var(--color-accent-green)"
          right={
            yoyLabel ? (
              <span
                className="font-mono text-[10px] uppercase tracking-[0.12em]"
                style={{
                  color: yoyPositive
                    ? "var(--color-success)"
                    : "var(--color-text-warning)",
                }}
              >
                {yoyLabel} · 14gg
              </span>
            ) : null
          }
        />
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
          }}
        >
          <TerminalKPICard
            index="05"
            label="Fatturato mese"
            value={formatCurrency(monthlyRevenue)}
            numericValue={monthlyRevenue}
            previousValue={prevRevenue > 0 ? prevRevenue : undefined}
            sparklineData={
              revenueSparkline.length > 1 ? revenueSparkline : undefined
            }
            hint="vs mese scorso"
          />
          <TerminalKPICard
            index="06"
            label="Ticket medio"
            value={
              avgTicket && avgTicket > 0
                ? formatCurrency(Math.round(avgTicket))
                : "—"
            }
            numericValue={
              avgTicket && avgTicket > 0 ? Math.round(avgTicket) : undefined
            }
            previousValue={
              avgTicketPrev && avgTicketPrev > 0
                ? Math.round(avgTicketPrev)
                : undefined
            }
            hint="ultimi 14 giorni"
          />
          <TerminalKPICard
            index="07"
            label="Revenue Δ"
            value={yoyLabel ?? "—"}
            hint="14gg vs 14gg prec."
          />
        </div>
      </section>
    </div>
  );
}
