"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { Plus, Search, Trash2 } from "lucide-react";
import { formatCurrency, formatUnitShort } from "@/lib/utils/formatters";
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
const ROW_HEIGHT = 68; // matches py-4 + content line-height

type Props = {
  supplierId: string;
  initialItems: ProductListItem[];
  initialNextCursor: string | null;
  categories: Array<{ id: string; name: string }>;
  sort: ProductListSort;
  filters: ProductListFilters;
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

  // Controlled search input; debounce applies to URL update only.
  const [searchValue, setSearchValue] = useState(filters.q ?? "");
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === "") next.delete(key);
        else next.set(key, value);
      }
      // Any change resets pagination cursor.
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

  // Virtualization only kicks in for large result sets — small lists
  // skip the setup cost and render normally.
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

  if (initialItems.length === 0) {
    return (
      <Card className="text-center py-16">
        <p className="text-sage mb-4">
          {filters.q || filters.category_id || filters.is_available !== undefined
            ? "Nessun prodotto corrisponde ai filtri."
            : "Nessun prodotto nel catalogo."}
        </p>
        <Link href="/supplier/catalogo/nuovo">
          <Button>
            <Plus className="h-4 w-4" /> Aggiungi il primo prodotto
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="h-4 w-4 text-sage absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cerca per nome, SKU, brand…"
            className="pl-9"
          />
        </div>
        <select
          className="h-10 rounded-xl border border-sage-muted/40 bg-white px-3 text-sm"
          value={filters.category_id ?? ""}
          onChange={(e) =>
            updateParams({ category_id: e.target.value || undefined })
          }
        >
          <option value="">Tutte le categorie</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-xl border border-sage-muted/40 bg-white px-3 text-sm"
          value={
            filters.is_available === true
              ? "active"
              : filters.is_available === false
                ? "inactive"
                : ""
          }
          onChange={(e) =>
            updateParams({ availability: e.target.value || undefined })
          }
        >
          <option value="">Tutti</option>
          <option value="active">Attivi</option>
          <option value="inactive">Disattivati</option>
        </select>
        <select
          className="h-10 rounded-xl border border-sage-muted/40 bg-white px-3 text-sm"
          value={sort}
          onChange={(e) => updateParams({ sort: e.target.value })}
        >
          <option value="created_desc">Più recenti</option>
          <option value="name_asc">Nome A→Z</option>
          <option value="price_asc">Prezzo ↑</option>
          <option value="price_desc">Prezzo ↓</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="grid grid-cols-[40px_1fr_160px_120px_160px] gap-2 px-6 py-3 bg-gray-50 text-xs font-semibold text-sage uppercase tracking-wider">
          <div>
            <input type="checkbox" disabled title="Disponibile in Fase 2C" />
          </div>
          <div>Prodotto</div>
          <div>Prezzo</div>
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
                  className="grid grid-cols-[40px_1fr_160px_120px_160px] gap-2 px-6 py-4 border-t border-sage-muted/20 hover:bg-gray-50/50 items-center"
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
                      : undefined
                  }
                >
                  <div>
                    <input
                      type="checkbox"
                      disabled
                      title="Selezione multipla — Fase 2C"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-charcoal truncate">
                      {p.name}
                    </p>
                    {(p.brand || p.sku) && (
                      <p className="text-xs text-sage truncate">
                        {p.brand}
                        {p.brand && p.sku ? " · " : ""}
                        {p.sku ? `SKU ${p.sku}` : ""}
                      </p>
                    )}
                  </div>
                  <div>
                    <span className="font-mono font-bold text-forest">
                      {formatCurrency(p.price)}/
                      {formatUnitShort(p.unit as UnitType)}
                    </span>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => onToggle(p.id, !p.is_available)}
                      className="focus:outline-none"
                      title="Attiva/disattiva"
                    >
                      <Badge
                        variant={p.is_available ? "success" : "default"}
                      >
                        {p.is_available ? "Attivo" : "Disattivato"}
                      </Badge>
                    </button>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <Link href={`/supplier/catalogo/${p.id}`}>
                      <Button variant="ghost" size="sm">
                        Modifica
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(p.id, p.name)}
                      title="Elimina"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Load more */}
      {initialNextCursor && (
        <div className="flex justify-center mt-6">
          <Button
            variant="secondary"
            onClick={onLoadMore}
            disabled={isPending}
          >
            {isPending ? "Carico…" : "Carica altri"}
          </Button>
        </div>
      )}
    </div>
  );
}
