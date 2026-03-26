"use client";

import { useSearch } from "@/lib/hooks/useSearch";
import { ProductSearch } from "@/components/products/product-search";
import { Filters } from "@/components/products/filters";
import { ProductCard } from "@/components/products/product-card";
import { SkeletonCard } from "@/components/ui/skeleton";

interface SearchPageClientProps {
  categories: { id: string; name: string; slug: string }[];
}

export function SearchPageClient({ categories }: SearchPageClientProps) {
  const { query, setQuery, results, isLoading, totalHits, filters, setFilters } = useSearch();

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal mb-6">Cerca Prodotti</h1>

      <ProductSearch
        query={query}
        onQueryChange={setQuery}
        totalHits={totalHits}
        isLoading={isLoading}
      />

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters sidebar */}
        <div className="lg:col-span-1">
          <Filters
            filters={filters}
            onFiltersChange={setFilters}
            categories={categories}
          />
        </div>

        {/* Results */}
        <div className="lg:col-span-3">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : results.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {results.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : query ? (
            <div className="text-center py-16">
              <p className="text-sage text-lg">
                Nessun risultato per &quot;{query}&quot;
              </p>
              <p className="text-sm text-sage mt-1">
                Prova con termini diversi o rimuovi i filtri
              </p>
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-sage text-lg">
                Inizia a cercare un prodotto
              </p>
              <p className="text-sm text-sage mt-1">
                Es: &quot;pomodori pelati&quot;, &quot;olio extravergine&quot;, &quot;mozzarella&quot;
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
