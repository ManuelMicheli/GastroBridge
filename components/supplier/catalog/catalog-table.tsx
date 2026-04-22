"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import { toast } from "@/components/ui/toast";
import {
  ArrowUpDown,
  PackageOpen,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { formatCurrency, formatUnitShort } from "@/lib/utils/formatters";
import { StatusDot } from "@/components/ui/status-dot";
import type { UnitType } from "@/types/database";
import {
  deleteProduct,
  toggleProductAvailability,
} from "@/lib/supplier/catalog/actions";
import type {
  ProductListFilters,
  ProductListItem,
  ProductListSort,
} from "@/lib/supplier/catalog/queries";

const VIRTUALIZE_THRESHOLD = 100;
const ROW_HEIGHT = 64;

type Props = {
  supplierId: string;
  initialItems: ProductListItem[];
  initialNextCursor: string | null;
  categories: Array<{ id: string; name: string }>;
  sort: ProductListSort;
  filters: ProductListFilters;
};

const SORT_LABEL: Record<ProductListSort, string> = {
  created_desc: "Più recenti",
  name_asc: "Nome A→Z",
  price_asc: "Prezzo ↑",
  price_desc: "Prezzo ↓",
};

export function CatalogTable({
  supplierId: _supplierId,
  initialItems,
  initialNextCursor,
  categories,
  sort,
  filters,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [searchValue, setSearchValue] = useState(filters.q ?? "");
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === "") next.delete(key);
        else next.set(key, value);
      }
      if (!("cursor" in patch)) next.delete("cursor");
      startTransition(() => {
        router.replace(`?${next.toString()}`, { scroll: false });
      });
    },
    [router, searchParams],
  );

  const onSearchChange = useCallback(
    (value: string) => {
      setSearchValue(value);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
        updateParams({ q: value || undefined });
      }, 300);
    },
    [updateParams],
  );

  const onLoadMore = useCallback(() => {
    if (!initialNextCursor) return;
    updateParams({ cursor: initialNextCursor });
  }, [initialNextCursor, updateParams]);

  const onToggle = useCallback(
    async (productId: string, next: boolean) => {
      const result = await toggleProductAvailability(productId, next);
      if (!result.ok) {
        toast.error(result.error);
      } else {
        toast.success(next ? "Prodotto attivato" : "Prodotto disattivato");
        router.refresh();
      }
    },
    [router],
  );

  const onDelete = useCallback(
    async (productId: string, name: string) => {
      if (
        !window.confirm(
          `Eliminare definitivamente "${name}"? L'azione non è reversibile.`,
        )
      ) {
        return;
      }
      const result = await deleteProduct(productId);
      if (!result.ok) {
        toast.error(result.error);
      } else {
        toast.success("Prodotto eliminato");
        router.refresh();
      }
    },
    [router],
  );

  const shouldVirtualize = initialItems.length >= VIRTUALIZE_THRESHOLD;

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: initialItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    enabled: shouldVirtualize,
  });

  const visibleRows = useMemo(() => {
    return shouldVirtualize
      ? virtualizer.getVirtualItems()
      : initialItems.map((_, i) => ({ index: i, start: i * ROW_HEIGHT }));
  }, [shouldVirtualize, virtualizer, initialItems]);

  const activeFilterCount =
    (filters.q ? 1 : 0) +
    (filters.category_id ? 1 : 0) +
    (filters.is_available !== undefined ? 1 : 0);

  if (initialItems.length === 0) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface-card px-6 py-16 text-center">
        <PackageOpen
          className="mx-auto mb-3 h-7 w-7 text-text-tertiary"
          aria-hidden
        />
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
          {activeFilterCount > 0
            ? "Nessun prodotto corrisponde ai filtri"
            : "Catalogo vuoto · aggiungi il primo prodotto"}
        </p>
        <Link
          href="/supplier/catalogo/nuovo"
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-base px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-text-primary transition-colors hover:border-accent-green hover:text-accent-green"
        >
          <Plus className="h-3.5 w-3.5" /> Nuovo prodotto
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-subtle bg-surface-card px-3 py-2.5">
        <div className="relative flex flex-1 items-center min-w-[220px]">
          <Search
            aria-hidden
            className="absolute left-2 h-3.5 w-3.5 text-text-tertiary"
          />
          <input
            type="search"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cerca per nome, SKU, brand..."
            className="w-full rounded-md border border-border-subtle bg-surface-base py-1.5 pl-7 pr-7 font-mono text-[12px] text-text-primary placeholder:text-text-tertiary focus:border-accent-green focus:outline-none"
            aria-label="Cerca prodotti"
          />
          {searchValue && (
            <button
              onClick={() => {
                setSearchValue("");
                updateParams({ q: undefined });
              }}
              className="absolute right-1.5 rounded-sm p-0.5 text-text-tertiary hover:bg-surface-hover hover:text-text-primary"
              aria-label="Pulisci ricerca"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <TerminalSelect
          icon={<SlidersHorizontal className="h-3 w-3" aria-hidden />}
          value={filters.category_id ?? ""}
          onChange={(v) => updateParams({ category_id: v || undefined })}
          options={[
            { value: "", label: "Tutte le categorie" },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
          ariaLabel="Filtra per categoria"
        />
        <TerminalSelect
          value={
            filters.is_available === true
              ? "active"
              : filters.is_available === false
                ? "inactive"
                : ""
          }
          onChange={(v) => updateParams({ availability: v || undefined })}
          options={[
            { value: "", label: "Tutti" },
            { value: "active", label: "Attivi" },
            { value: "inactive", label: "Disattivati" },
          ]}
          ariaLabel="Filtra per disponibilità"
        />
        <TerminalSelect
          icon={<ArrowUpDown className="h-3 w-3" aria-hidden />}
          value={sort}
          onChange={(v) =>
            updateParams({ sort: v || undefined })
          }
          options={(Object.keys(SORT_LABEL) as ProductListSort[]).map((k) => ({
            value: k,
            label: SORT_LABEL[k],
          }))}
          ariaLabel="Ordinamento"
        />
        <span className="font-mono text-[10px] tabular-nums text-text-tertiary">
          {initialItems.length} {initialItems.length === 1 ? "prodotto" : "prodotti"}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-card">
        <div className="grid grid-cols-[40px_44px_minmax(0,1fr)_140px_120px_128px] gap-x-3 border-b border-border-subtle px-4 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
          <div>
            <input type="checkbox" disabled title="Disponibile in Fase 2C" />
          </div>
          <div>IMG</div>
          <div>Prodotto</div>
          <div className="text-right">Prezzo</div>
          <div>Stato</div>
          <div className="text-right">Azioni</div>
        </div>

        <div
          ref={scrollRef}
          className={shouldVirtualize ? "max-h-[70vh] overflow-auto" : ""}
          style={
            shouldVirtualize
              ? { height: Math.min(initialItems.length * ROW_HEIGHT + 4, 600) }
              : undefined
          }
        >
          <div
            style={
              shouldVirtualize
                ? {
                    height: `${virtualizer.getTotalSize()}px`,
                    position: "relative",
                  }
                : undefined
            }
          >
            {visibleRows.map((vr) => {
              const p = initialItems[vr.index]!;
              return (
                <div
                  key={p.id}
                  className="group grid grid-cols-[40px_44px_minmax(0,1fr)_140px_120px_128px] items-center gap-x-3 border-l-2 border-transparent border-t border-t-border-subtle/60 px-4 transition-colors hover:border-l-accent-green hover:bg-surface-hover"
                  style={
                    shouldVirtualize
                      ? {
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          transform: `translateY(${vr.start}px)`,
                          height: `${ROW_HEIGHT}px`,
                        }
                      : { minHeight: ROW_HEIGHT }
                  }
                >
                  <div>
                    <input
                      type="checkbox"
                      disabled
                      title="Selezione multipla — Fase 2C"
                    />
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-md border border-border-subtle bg-surface-base">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-tertiary">
                        {p.name.slice(0, 2)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-text-primary">
                      {p.name}
                    </p>
                    {(p.brand || p.sku) && (
                      <p className="truncate font-mono text-[10px] uppercase tracking-[0.06em] text-text-tertiary">
                        {p.brand}
                        {p.brand && p.sku ? " · " : ""}
                        {p.sku ? `SKU ${p.sku}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <span className="text-[13px] text-text-primary">
                      {formatCurrency(p.price)}
                    </span>
                    <span className="ml-0.5 text-[10px] uppercase text-text-tertiary">
                      /{formatUnitShort(p.unit as UnitType)}
                    </span>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => onToggle(p.id, !p.is_available)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-text-secondary transition-colors hover:border-accent-green hover:text-accent-green"
                      title="Attiva/disattiva"
                    >
                      <StatusDot
                        tone={p.is_available ? "emerald" : "neutral"}
                        size={8}
                      />
                      {p.is_available ? "Attivo" : "Disatt."}
                    </button>
                  </div>
                  <div className="flex items-center justify-end gap-0.5 opacity-60 transition-opacity duration-150 group-hover:opacity-100">
                    <Link
                      href={`/supplier/catalogo/${p.id}`}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-text-secondary hover:bg-surface-base hover:text-text-primary"
                    >
                      <Pencil className="h-3 w-3" aria-hidden /> Modifica
                    </Link>
                    <button
                      type="button"
                      onClick={() => onDelete(p.id, p.name)}
                      className="rounded-md p-1 text-text-tertiary hover:bg-accent-red/10 hover:text-accent-red"
                      title="Elimina"
                      aria-label="Elimina prodotto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {initialNextCursor && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-card px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-text-secondary hover:border-accent-green hover:text-accent-green disabled:opacity-60"
          >
            {isPending ? "Carico…" : "Carica altri →"}
          </button>
        </div>
      )}
    </div>
  );
}

function TerminalSelect({
  value,
  onChange,
  options,
  ariaLabel,
  icon,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  ariaLabel: string;
  icon?: React.ReactNode;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-surface-base px-2 py-1 font-mono text-[11px] text-text-secondary transition-colors focus-within:border-accent-green focus-within:text-text-primary hover:border-accent-green/50">
      {icon}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="bg-transparent pr-5 font-mono text-[11px] text-text-secondary focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
