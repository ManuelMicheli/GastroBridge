"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { formatCurrency, formatUnitShort } from "@/lib/utils/formatters";
import type { UnitType } from "@/types/database";
import type {
  ProductListFilters,
  ProductListItem,
  ProductListSort,
} from "@/lib/supplier/catalog/queries";

type Props = {
  supplierId: string;
  initialItems: ProductListItem[];
  initialNextCursor: string | null;
  categories: Array<{ id: string; name: string }>;
  sort: ProductListSort;
  filters: ProductListFilters;
};

export function SupplierProductsGrid({
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

  if (initialItems.length === 0) {
    return (
      <Card className="text-center py-16">
        <p className="text-sage">
          {filters.q || filters.category_id
            ? "Nessun prodotto corrisponde ai filtri."
            : "Questo fornitore non ha prodotti disponibili."}
        </p>
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
            placeholder="Cerca nel catalogo…"
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
          value={sort}
          onChange={(e) => updateParams({ sort: e.target.value })}
        >
          <option value="name_asc">Nome A→Z</option>
          <option value="price_asc">Prezzo ↑</option>
          <option value="price_desc">Prezzo ↓</option>
          <option value="created_desc">Più recenti</option>
        </select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {initialItems.map((p) => (
          <Card key={p.id} className="hover:shadow-elevated transition-shadow">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-charcoal truncate">
                  {p.name}
                </h3>
                {p.brand && (
                  <p className="text-xs text-sage truncate">{p.brand}</p>
                )}
              </div>
              {p.is_featured && (
                <Badge variant="warning" className="shrink-0">
                  In evidenza
                </Badge>
              )}
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-xl font-mono font-bold text-forest">
                {formatCurrency(p.price)}
              </span>
              <span className="text-sm text-sage">
                /{formatUnitShort(p.unit as UnitType)}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {initialNextCursor && (
        <div className="flex justify-center mt-6">
          <Button
            variant="secondary"
            onClick={() => updateParams({ cursor: initialNextCursor })}
            disabled={isPending}
          >
            {isPending ? "Carico…" : "Carica altri"}
          </Button>
        </div>
      )}
    </div>
  );
}
