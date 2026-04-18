// app/(app)/cataloghi/confronta/_components/compare-filter-bar.tsx
//
// Compact mono filter row: search input, two boolean chips (≥2 fornitori,
// solo più ordinati), and a CSV export button at the right edge. Matches
// the sibling redesigns' density (min-h-[32px], mono 11px, accent-green
// on active state).

"use client";

import { ArrowDownToLine, Search } from "lucide-react";

type Props = {
  query: string;
  onQueryChange: (q: string) => void;
  onlyMulti: boolean;
  onOnlyMultiChange: (v: boolean) => void;
  onlyOrdered: boolean;
  onOnlyOrderedChange: (v: boolean) => void;
  orderedCount: number;
  visibleCount: number;
  totalCount: number;
  onExportCsv: () => void;
};

export function CompareFilterBar({
  query,
  onQueryChange,
  onlyMulti,
  onOnlyMultiChange,
  onlyOrdered,
  onOnlyOrderedChange,
  orderedCount,
  visibleCount,
  totalCount,
  onExportCsv,
}: Props) {
  const orderedDisabled = orderedCount === 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="shrink-0 px-1 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
        Prodotti
      </span>

      <div className="relative flex min-w-0 flex-1 items-center md:flex-none md:w-64">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-text-tertiary"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Cerca prodotto..."
          aria-label="Cerca prodotto"
          className="h-8 w-full rounded-md border border-border-subtle bg-surface-card pl-8 pr-16 font-mono text-[12px] text-text-primary placeholder:text-text-tertiary focus:border-accent-green/40 focus:outline-none focus:ring-1 focus:ring-accent-green/30"
        />
        <span className="pointer-events-none absolute right-2 font-mono text-[10px] uppercase tracking-wide text-text-tertiary">
          <span className="tabular-nums text-text-secondary">
            {visibleCount}
          </span>
          /{totalCount}
        </span>
      </div>

      <ToggleChip
        label="≥2 fornitori"
        active={onlyMulti}
        onClick={() => onOnlyMultiChange(!onlyMulti)}
      />

      <ToggleChip
        label="Più ordinati"
        count={orderedCount > 0 ? orderedCount : undefined}
        active={onlyOrdered}
        disabled={orderedDisabled}
        title={
          orderedDisabled
            ? "Nessun ordine recente da cui dedurre i prodotti"
            : undefined
        }
        onClick={() => onOnlyOrderedChange(!onlyOrdered)}
      />

      <button
        type="button"
        onClick={onExportCsv}
        className="ml-auto inline-flex min-h-[32px] items-center gap-1.5 rounded-md border border-border-subtle px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.04em] text-text-secondary hover:bg-surface-hover hover:text-text-primary"
      >
        <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden />
        <span>CSV</span>
      </button>
    </div>
  );
}

function ToggleChip({
  label,
  count,
  active,
  disabled = false,
  title,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.04em] transition-colors ${
        disabled
          ? "cursor-not-allowed border-border-subtle/50 text-text-tertiary"
          : active
            ? "border-accent-green/40 bg-accent-green/10 text-accent-green"
            : "border-border-subtle text-text-secondary hover:text-text-primary hover:bg-surface-hover"
      }`}
    >
      <span
        aria-hidden
        className={`inline-flex h-3 w-3 items-center justify-center rounded-sm border ${
          active
            ? "border-accent-green bg-accent-green/80 text-surface-base"
            : "border-border-subtle"
        }`}
      >
        {active && (
          <svg
            viewBox="0 0 10 10"
            className="h-2 w-2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M1.5 5 L4 7.5 L8.5 2.5" />
          </svg>
        )}
      </span>
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`tabular-nums ${
            active ? "text-accent-green" : "text-text-tertiary"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
