"use client";

import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, X } from "lucide-react";

interface FiltersProps {
  filters: {
    category_id?: string;
    unit?: string;
    priceMin?: number;
    priceMax?: number;
  };
  onFiltersChange: (filters: FiltersProps["filters"]) => void;
  categories: { id: string; name: string }[];
}

const UNIT_OPTIONS = [
  { value: "", label: "Tutte le unita" },
  { value: "kg", label: "Chilogrammo" },
  { value: "lt", label: "Litro" },
  { value: "pz", label: "Pezzo" },
  { value: "cartone", label: "Cartone" },
  { value: "bottiglia", label: "Bottiglia" },
  { value: "confezione", label: "Confezione" },
];

export function Filters({ filters, onFiltersChange, categories }: FiltersProps) {
  const hasActiveFilters = Object.values(filters).some((v) => v != null && v !== "");

  return (
    <div className="bg-white rounded-2xl p-4 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-sage" />
          <span className="text-sm font-semibold text-charcoal">Filtri</span>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFiltersChange({})}
            className="text-xs"
          >
            <X className="h-3 w-3" /> Resetta
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <Select
          label="Categoria"
          options={[
            { value: "", label: "Tutte le categorie" },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
          value={filters.category_id ?? ""}
          onChange={(e) =>
            onFiltersChange({ ...filters, category_id: e.target.value || undefined })
          }
        />
        <Select
          label="Unita"
          options={UNIT_OPTIONS}
          value={filters.unit ?? ""}
          onChange={(e) =>
            onFiltersChange({ ...filters, unit: e.target.value || undefined })
          }
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold text-charcoal mb-1 block">Min €</label>
            <input
              type="number"
              min={0}
              step={0.5}
              placeholder="0"
              value={filters.priceMin ?? ""}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  priceMin: e.target.value ? parseFloat(e.target.value) : undefined,
                })
              }
              className="w-full border border-sage-muted rounded-lg py-2 px-3 text-sm focus:border-forest focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-charcoal mb-1 block">Max €</label>
            <input
              type="number"
              min={0}
              step={0.5}
              placeholder="100"
              value={filters.priceMax ?? ""}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  priceMax: e.target.value ? parseFloat(e.target.value) : undefined,
                })
              }
              className="w-full border border-sage-muted rounded-lg py-2 px-3 text-sm focus:border-forest focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
