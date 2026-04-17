// app/(app)/fornitori/_lib/types.ts
import type { RelationshipStatus } from "@/lib/relationships/types";

export type SupplierLite = {
  id: string;
  company_name: string;
  description: string | null;
  city: string | null;
  province: string | null;
  rating_avg: number | null;
  rating_count: number | null;
  is_verified: boolean | null;
  certifications: string[] | null;
  logo_url: string | null;
};

export type RelationshipRow = {
  id: string;
  status: RelationshipStatus;
  invited_at: string;
  supplier: SupplierLite | null;
};

export type SortMode = "recent" | "name" | "rating";

export type SupplierFacetState = {
  statuses: Set<RelationshipStatus>;
  cities: Set<string>;
  certs: Set<string>;
  verifiedOnly: boolean;
  minRating: number;
};

export function emptyFacets(): SupplierFacetState {
  return {
    statuses: new Set(),
    cities: new Set(),
    certs: new Set(),
    verifiedOnly: false,
    minRating: 0,
  };
}

export function hasActiveFacets(f: SupplierFacetState): boolean {
  return (
    f.statuses.size > 0 ||
    f.cities.size > 0 ||
    f.certs.size > 0 ||
    f.verifiedOnly ||
    f.minRating > 0
  );
}

/** Score-style colour class for a 0–5 rating. */
export function ratingColorClass(rating: number): string {
  if (rating >= 4.5) return "text-accent-green";
  if (rating >= 4) return "text-green-500";
  if (rating >= 3) return "text-yellow-500";
  if (rating > 0) return "text-orange-500";
  return "text-text-tertiary";
}

/** Normalize a string for case-insensitive / accent-free contains() matching. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}
