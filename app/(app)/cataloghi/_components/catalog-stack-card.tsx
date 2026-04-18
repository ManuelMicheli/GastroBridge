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

/**
 * Rich Stripe/Vercel-dashboard-style card for a supplier catalog.
 * Shows identity, price-range visualization, top category proxy, meta.
 */
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
  const sourceLabel = isConnected ? "DA PIATTAFORMA" : "MANUALE";
  const sourceBadgeClass = isConnected
    ? "border-accent-blue/40 bg-accent-blue/10 text-accent-blue"
    : "border-border-subtle bg-surface-base text-text-tertiary";

  return (
    <article
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-green/30 hover:shadow-[var(--shadow-elevated)] focus-within:border-accent-green/40"
      aria-labelledby={`catalog-${id}-title`}
    >
      {/* Header: avatar + title + count */}
      <header className="flex items-start gap-3">
        <div
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-green/10 font-mono text-sm font-semibold uppercase tracking-tight text-accent-green"
        >
          {initials(supplierName)}
        </div>
        <div className="min-w-0 flex-1">
          <h3
            id={`catalog-${id}-title`}
            className="truncate text-base font-semibold leading-tight text-text-primary"
            title={supplierName}
          >
            {supplierName}
          </h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] uppercase tracking-wide text-text-tertiary">
            <span>
              <span className="tabular-nums">{itemCount}</span> prodott{itemCount === 1 ? "o" : "i"}
            </span>
            <span
              className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] ${sourceBadgeClass}`}
              title={
                isConnected
                  ? "Fornitore collegato sulla piattaforma"
                  : "Listino inserito manualmente"
              }
            >
              {sourceLabel}
            </span>
          </p>
        </div>
      </header>

      <div className="my-3 border-t border-border-subtle" />

      {/* Price range block */}
      <section aria-label="Fascia di prezzo">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
          Fascia di prezzo
        </p>
        {hasPrices ? (
          <>
            <PriceRangeBar min={priceMin!} max={priceMax!} marker={priceMedian} />
            <p className="mt-2 font-mono text-[11px] tabular-nums text-text-secondary">
              <span className="text-text-tertiary">AVG</span>{" "}
              <span className="text-text-primary">
                {priceAvg !== null ? formatCurrency(priceAvg) : "—"}
              </span>
              <span className="mx-2 text-text-tertiary">·</span>
              <span className="text-text-tertiary">MED</span>{" "}
              <span className="text-text-primary">
                {priceMedian !== null ? formatCurrency(priceMedian) : "—"}
              </span>
            </p>
          </>
        ) : (
          <p className="font-mono text-[11px] text-text-tertiary">
            Nessun prodotto ancora importato
          </p>
        )}
      </section>

      {/* Top categories (only when at least one exists and count > 1) */}
      {topCategories.length > 0 && (
        <>
          <div className="my-3 border-t border-border-subtle" />
          <section aria-label="Categorie principali">
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
              Categorie principali
            </p>
            <p className="font-mono text-[11px] text-text-secondary">
              {topCategories.map((c, i) => (
                <span key={c.label}>
                  <span className="text-text-primary">{c.label}</span>
                  <span className="mx-1 text-text-tertiary">·</span>
                  <span className="tabular-nums text-text-tertiary">{c.count}</span>
                  {i < topCategories.length - 1 && (
                    <span className="mx-2 text-border-subtle">|</span>
                  )}
                </span>
              ))}
            </p>
          </section>
        </>
      )}

      <div className="my-3 border-t border-border-subtle" />

      {/* Meta row: lead / min order / updated */}
      <section className="space-y-1" aria-label="Informazioni consegna">
        <p className="font-mono text-[11px] tabular-nums text-text-secondary">
          {deliveryDays !== null ? (
            <>
              <span className="text-text-tertiary">lead</span>{" "}
              <span className="text-text-primary">{deliveryDays}g</span>
            </>
          ) : (
            <span className="text-text-tertiary">lead —</span>
          )}
          <span className="mx-2 text-text-tertiary">·</span>
          {minOrderAmount !== null ? (
            <>
              <span className="text-text-tertiary">min</span>{" "}
              <span className="text-text-primary">{formatCurrency(minOrderAmount)}</span>
            </>
          ) : (
            <span className="text-text-tertiary">min —</span>
          )}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">
          aggiornato {formatRelativeTime(updatedAt)}
        </p>
      </section>

      {/* Actions */}
      <footer className="mt-4 flex items-center gap-2">
        <Link
          href={openHref}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border-subtle bg-surface-base px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-text-primary transition-colors hover:border-accent-green/40 hover:bg-surface-hover"
        >
          {isConnected ? "Apri fornitore" : "Apri catalogo"}
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
        <Link
          href="/cataloghi/confronta"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border-subtle px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-text-secondary transition-colors hover:border-accent-green/40 hover:text-text-primary"
          title="Confronta con altri cataloghi"
          aria-label="Confronta"
        >
          <GitCompareArrows className="h-3 w-3" aria-hidden />
          Confronta
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
