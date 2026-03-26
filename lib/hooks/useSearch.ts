"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { meilisearch, PRODUCTS_INDEX } from "@/lib/meilisearch/client";

interface SearchFilters {
  category_id?: string;
  subcategory_id?: string;
  unit?: string;
  priceMin?: number;
  priceMax?: number;
  certifications?: string[];
}

interface SearchResult {
  id: string;
  name: string;
  brand: string | null;
  description: string | null;
  unit: string;
  price: number;
  image_url: string | null;
  certifications: string[] | null;
  origin: string | null;
  category_name: string;
  subcategory_name: string | null;
  supplier_id: string;
  supplier_name: string;
  supplier_city: string | null;
  supplier_rating: number;
  supplier_verified: boolean;
}

export function useSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalHits, setTotalHits] = useState(0);
  const [filters, setFilters] = useState<SearchFilters>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback(
    async (searchQuery: string, searchFilters: SearchFilters) => {
      setIsLoading(true);
      try {
        const filterArr: string[] = [];
        if (searchFilters.category_id) filterArr.push(`category_id = "${searchFilters.category_id}"`);
        if (searchFilters.subcategory_id) filterArr.push(`subcategory_id = "${searchFilters.subcategory_id}"`);
        if (searchFilters.unit) filterArr.push(`unit = "${searchFilters.unit}"`);
        if (searchFilters.priceMin != null) filterArr.push(`price >= ${searchFilters.priceMin}`);
        if (searchFilters.priceMax != null) filterArr.push(`price <= ${searchFilters.priceMax}`);

        const index = meilisearch.index(PRODUCTS_INDEX);
        const response = await index.search<SearchResult>(searchQuery, {
          filter: filterArr.length > 0 ? filterArr.join(" AND ") : undefined,
          limit: 50,
          sort: ["price:asc"],
        });

        setResults(response.hits);
        setTotalHits(response.estimatedTotalHits ?? response.hits.length);
      } catch {
        setResults([]);
        setTotalHits(0);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search(query, filters);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, filters, search]);

  return {
    query,
    setQuery,
    results,
    isLoading,
    totalHits,
    filters,
    setFilters,
  };
}
