"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils/formatters";

interface ProductSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  totalHits: number;
  isLoading: boolean;
}

export function ProductSearch({
  query,
  onQueryChange,
  totalHits,
  isLoading,
}: ProductSearchProps) {
  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-sage" />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Cerca prodotti, brand, fornitori..."
          className="w-full pl-12 pr-12 py-4 border-2 border-sage-muted rounded-2xl font-body text-charcoal placeholder:text-sage focus:border-forest focus:outline-none transition-colors text-lg"
          aria-label="Cerca prodotti"
        />
        {query && (
          <button
            onClick={() => onQueryChange("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-sage-muted/30"
            aria-label="Cancella ricerca"
          >
            <X className="h-5 w-5 text-sage" />
          </button>
        )}
      </div>
      {query && (
        <p className="mt-2 text-sm text-sage">
          {isLoading ? "Cercando..." : `${totalHits} risultati trovati`}
        </p>
      )}
    </div>
  );
}
