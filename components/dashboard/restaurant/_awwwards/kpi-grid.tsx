// components/dashboard/restaurant/_awwwards/kpi-grid.tsx
//
// Monthly summary grid for the restaurant dashboard. Two typographic groups:
//   01 · ACQUISTI     — Ordini / Spesa media / Risparmio / Fornitori
//   02 · INCASSI POS  — Incasso / Food cost % / Scontrini / Coperti
// Cells reuse TerminalKPICard for count-up, delta chip, sparkline, corner
// brackets and the bottom scan-line hover detail. Group headers are pure
// typography — no coloured chips — to keep the terminal aesthetic restrained.
// The big aggregate spending number was intentionally dropped: the spend
// trend chart below the card already surfaces it.

"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { TerminalKPICard } from "@/components/dashboard/cards/terminal-kpi-card";
import { formatCurrency } from "@/lib/utils/formatters";
import { formatCentsCompact, formatPct } from "@/lib/fiscal/format";

export type Delta = {
  sign: "+" | "-" | "";
  pct: string;
  positive: boolean;
};

type FiscalSummary = {
  enabled: boolean;
  revenueCents: number;
  foodCostPct: number | null;
  receipts: number;
  covers: number;
  restaurantId: string | null;
  revenueSpark: number[];
  receiptsSpark: number[];
  coversSpark: number[];
  foodCostSpark: number[];
};

export type KpiGridProps = {
  ordersThisMonth: number;
  prevMonthOrders: number;
  ordersDelta: Delta;
  avgOrder: number;
  prevAvgOrder: number;
  savings: number;
  activeSuppliers: number;
  fiscal: FiscalSummary;
};

/**
 * Typographic group header. Big faded index → bold label → muted subtitle
 * on one line, divided from the cells below by a hairline rule with a small
 * tick cap on each end (awwwards terminal detail). Optional `right` accessory
 * sits flush-right on the rule.
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
  accent: string; // CSS var reference, e.g. "var(--color-accent-amber)"
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
      {/* Hairline rule with tick caps — faint accent gradient cap on the left */}
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

export function KpiGrid({
  ordersThisMonth,
  prevMonthOrders,
  avgOrder,
  prevAvgOrder,
  savings,
  activeSuppliers,
  fiscal,
}: KpiGridProps) {
  const foodCostHint =
    fiscal.foodCostPct === null
      ? "in attesa dati"
      : fiscal.foodCostPct > 35
        ? "sopra soglia 35%"
        : "sotto soglia 35%";

  return (
    <div className="flex flex-col gap-7">
      {/* ── 01 · Acquisti ───────────────────────────────────────────────── */}
      <section aria-labelledby="kpi-group-acquisti" className="flex flex-col gap-4">
        <GroupHeader
          index="01"
          label="Acquisti"
          subtitle="Questo mese · dai fornitori"
          accent="var(--color-accent-amber)"
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
            label="Ordini"
            value={ordersThisMonth.toLocaleString("it-IT")}
            numericValue={ordersThisMonth}
            previousValue={prevMonthOrders}
            positiveIsGood
            hint="vs mese scorso"
          />
          <TerminalKPICard
            index="02"
            label="Spesa media"
            value={avgOrder > 0 ? formatCurrency(avgOrder) : "—"}
            numericValue={avgOrder > 0 ? avgOrder : undefined}
            previousValue={prevAvgOrder > 0 ? prevAvgOrder : undefined}
            positiveIsGood={false}
            hint="per ordine"
          />
          <TerminalKPICard
            index="03"
            label="Risparmio"
            value={formatCurrency(savings)}
            numericValue={savings}
            hint="stimato · confronto prezzi"
          />
          <TerminalKPICard
            index="04"
            label="Fornitori"
            value={activeSuppliers.toLocaleString("it-IT")}
            numericValue={activeSuppliers}
            hint="attivi"
          />
        </div>
      </section>

      {/* ── 02 · Incassi POS ────────────────────────────────────────────── */}
      <section aria-labelledby="kpi-group-incassi" className="flex flex-col gap-4">
        <GroupHeader
          index="02"
          label="Incassi POS"
          subtitle="Ultimi 30 giorni · scontrini casse"
          accent="var(--color-accent-green)"
          right={
            fiscal.enabled && fiscal.restaurantId ? (
              <Link
                href={`/finanze?r=${fiscal.restaurantId}`}
                className="group inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary hover:text-accent-green transition-colors"
              >
                <span>Finanze</span>
                <ArrowUpRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            ) : null
          }
        />
        {fiscal.enabled ? (
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(200px, 100%), 1fr))",
            }}
          >
            <TerminalKPICard
              index="05"
              label="Incasso"
              value={formatCentsCompact(fiscal.revenueCents)}
              numericValue={Math.round(fiscal.revenueCents / 100)}
              sparklineData={
                fiscal.revenueSpark.length > 1
                  ? fiscal.revenueSpark
                  : undefined
              }
              hint="POS collegati"
            />
            <TerminalKPICard
              index="06"
              label="Food cost %"
              value={formatPct(fiscal.foodCostPct)}
              numericValue={fiscal.foodCostPct ?? undefined}
              sparklineData={
                fiscal.foodCostSpark.length > 1
                  ? fiscal.foodCostSpark
                  : undefined
              }
              positiveIsGood={false}
              hint={foodCostHint}
            />
            <TerminalKPICard
              index="07"
              label="Scontrini"
              value={fiscal.receipts.toLocaleString("it-IT")}
              numericValue={fiscal.receipts}
              sparklineData={
                fiscal.receiptsSpark.length > 1
                  ? fiscal.receiptsSpark
                  : undefined
              }
              hint="ricevuti"
            />
            <TerminalKPICard
              index="08"
              label="Coperti"
              value={fiscal.covers.toLocaleString("it-IT")}
              numericValue={fiscal.covers}
              sparklineData={
                fiscal.coversSpark.length > 1 ? fiscal.coversSpark : undefined
              }
              hint="serviti"
            />
          </div>
        ) : (
          <FiscalInactive restaurantId={fiscal.restaurantId} />
        )}
      </section>
    </div>
  );
}

/**
 * Inactive state for the Incassi POS group. Deliberately quiet: a hairline
 * frame, a pair of corner brackets, a small readable pitch and a single
 * terminal-styled CTA. No coloured background, no icon chip.
 */
function FiscalInactive({ restaurantId }: { restaurantId: string | null }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border-subtle bg-surface-card px-5 py-5">
      {/* Corner brackets — top-right & bottom-left (match TerminalKPICard) */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-2.5 h-2.5 w-2.5 border-t border-r border-border-subtle opacity-60 transition-[opacity,border-color] duration-200 group-hover:border-accent-green group-hover:opacity-100"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-2.5 left-2.5 h-2.5 w-2.5 border-b border-l border-border-subtle opacity-60 transition-[opacity,border-color] duration-200 group-hover:border-accent-green group-hover:opacity-100"
      />

      <div className="flex flex-wrap items-center gap-5">
        <div className="flex flex-col gap-1 min-w-[240px] flex-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
            Cassetto fiscale · inattivo
          </span>
          <span className="text-[13px] text-text-secondary leading-snug">
            Collega una cassa POS per vedere{" "}
            <span className="text-text-primary">
              incasso, food cost, scontrini e coperti
            </span>{" "}
            qui in automatico.
          </span>
        </div>
        <Link
          href={
            restaurantId
              ? `/finanze/integrazioni?r=${restaurantId}`
              : "/finanze"
          }
          className="inline-flex items-center gap-1.5 border-b border-border-subtle pb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-text-primary hover:border-accent-green hover:text-accent-green transition-colors"
        >
          Attiva
          <ArrowUpRight className="h-3 w-3 transition-transform duration-200 hover:translate-x-0.5 hover:-translate-y-0.5" />
        </Link>
      </div>

      {/* Scan line — awwwards signature detail */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px scale-x-0 bg-gradient-to-r from-transparent via-accent-green to-transparent transition-transform duration-500 ease-out group-hover:scale-x-100"
      />
    </div>
  );
}
