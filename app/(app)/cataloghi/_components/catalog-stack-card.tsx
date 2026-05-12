// app/(app)/cataloghi/_components/catalog-stack-card.tsx
"use client";

import Link from "next/link";
import { ArrowRight, GitCompareArrows } from "lucide-react";
import { formatCurrency, formatRelativeTime } from "@/lib/utils/formatters";
import type { CatalogAggregates } from "../_lib/aggregates";
import { PriceRangeBar } from "./price-range-bar";

export type CatalogStackCardData = {
  id: string;
  supplierName: string;
  deliveryDays: number | null;
  minOrderAmount: number | null;
  notes: string | null;
  updatedAt: string;
  source: "manual" | "connected";
  aggregates: CatalogAggregates;
};

type Props = {
  catalog: CatalogStackCardData;
};

export function CatalogStackCard({ catalog }: Props) {
  const {
    id,
    supplierName,
    deliveryDays,
    minOrderAmount,
    updatedAt,
    source,
    aggregates,
  } = catalog;
  const {
    itemCount,
    priceMin,
    priceMax,
    priceAvg,
    priceMedian,
    topCategories,
  } = aggregates;

  const hasPrices =
    priceMin !== null && priceMax !== null && Number.isFinite(priceMin) && Number.isFinite(priceMax);

  const isConnected = source === "connected";
  const openHref = isConnected ? `/fornitori/${id}` : `/cataloghi/${id}`;
  const sourceLabel = isConnected ? "Piattaforma" : "Manuale";
  const sourceBadgeClass = isConnected
    ? "border-accent-blue/30 bg-accent-blue/8 text-accent-blue"
    : "border-border-subtle/70 bg-transparent text-text-tertiary";

  return (
    <article
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-green/30 hover:shadow-[var(--shadow-elevated)] focus-within:border-accent-green/40"
      aria-labelledby={`catalog-${id}-title`}
    >
      {/* Header — supplier identity */}
      <header className="flex items-start gap-3">
        <div
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-green/10 font-mono text-[13px] font-semibold uppercase tracking-tight text-accent-green ring-1 ring-inset ring-accent-green/15"
        >
          {initials(supplierName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3
              id={`catalog-${id}-title`}
              className="truncate text-[15px] font-semibold leading-snug text-text-primary"
              title={supplierName}
            >
              {supplierName}
            </h3>
            <span
              className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide ${sourceBadgeClass}`}
              title={
                isConnected
                  ? "Fornitore collegato sulla piattaforma"
                  : "Listino inserito manualmente"
              }
            >
              {sourceLabel}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-text-secondary/80">
            <span className="font-mono tabular-nums text-text-secondary">{itemCount}</span>{" "}
            {itemCount === 1 ? "prodotto" : "prodotti"}
          </p>
        </div>
      </header>

      <div className="my-4 h-px bg-border-subtle/60" />

      {/* Price block */}
      <section aria-label="Fascia di prezzo">
        <div className="flex items-baseline justify-between">
          <span className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-text-tertiary/80">
            Fascia di prezzo
          </span>
          {hasPrices && priceAvg !== null && (
            <span className="font-mono text-[11px] tabular-nums text-text-tertiary/70">
              media{" "}
              <span className="text-text-primary/90 font-medium">
                {formatCurrency(priceAvg)}
              </span>
            </span>
          )}
        </div>
        {hasPrices ? (
          <div className="mt-2.5">
            <PriceRangeBar min={priceMin!} max={priceMax!} marker={priceMedian} />
          </div>
        ) : (
          <p className="mt-2 text-[12px] text-text-tertiary/80">
            Nessun prodotto ancora importato
          </p>
        )}
      </section>

      {/* Categories */}
      {topCategories.length > 0 && (
        <>
          <div className="my-4 h-px bg-border-subtle/60" />
          <section aria-label="Categorie principali">
            <p className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.1em] text-text-tertiary/80">
              Categorie principali
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {topCategories.map((c) => (
                <li
                  key={c.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle/70 bg-surface-base/60 px-2 py-0.5 text-[11px] text-text-secondary"
                >
                  <span className="text-text-primary/90">{c.label}</span>
                  <span className="font-mono tabular-nums text-text-tertiary/80">
                    {c.count}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <div className="my-4 h-px bg-border-subtle/60" />

      {/* Meta — lead / min / updated */}
      <section
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-text-secondary"
        aria-label="Informazioni consegna"
      >
        <span className="inline-flex items-baseline gap-1">
          <span className="text-text-tertiary/80">Consegna</span>
          <span className="font-mono tabular-nums text-text-primary/90">
            {deliveryDays !== null ? `${deliveryDays}g` : "—"}
          </span>
        </span>
        <span className="h-1 w-1 rounded-full bg-border-subtle" aria-hidden />
        <span className="inline-flex items-baseline gap-1">
          <span className="text-text-tertiary/80">Min</span>
          <span className="font-mono tabular-nums text-text-primary/90">
            {minOrderAmount !== null ? formatCurrency(minOrderAmount) : "—"}
          </span>
        </span>
        <span className="ml-auto text-[10.5px] text-text-tertiary/70">
          {formatRelativeTime(updatedAt)}
        </span>
      </section>

      {/* Actions */}
      <footer className="mt-5 flex items-center gap-2">
        <Link
          href={openHref}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-[12px] font-medium text-text-primary transition-colors hover:border-accent-green/40 hover:bg-surface-hover"
        >
          {isConnected ? "Apri fornitore" : "Apri catalogo"}
          <ArrowRight className="h-3.5 w-3.5 opacity-70" aria-hidden />
        </Link>
        <Link
          href="/cataloghi/confronta"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border-subtle px-3 py-2 text-[12px] font-medium text-text-secondary transition-colors hover:border-accent-green/40 hover:text-text-primary"
          title="Confronta con altri cataloghi"
          aria-label="Confronta"
        >
          <GitCompareArrows className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">Confronta</span>
        </Link>
      </footer>
    </article>
  );
}

function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "—";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "—";
}
