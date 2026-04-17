// app/(app)/fornitori/_lib/url-state.ts
import type { RelationshipStatus } from "@/lib/relationships/types";
import { emptyFacets, type SupplierFacetState } from "./types";

const VALID_STATUSES: readonly RelationshipStatus[] = [
  "pending",
  "active",
  "paused",
  "rejected",
  "archived",
];

export type UrlState = {
  query: string;
  facets: SupplierFacetState;
  selectedId: string | null;
};

export function readUrlState(sp: URLSearchParams): UrlState {
  const facets = emptyFacets();

  const statusParam = sp.get("status");
  if (statusParam) {
    for (const s of statusParam.split(",")) {
      if ((VALID_STATUSES as readonly string[]).includes(s)) {
        facets.statuses.add(s as RelationshipStatus);
      }
    }
  }

  const cityParam = sp.get("city");
  if (cityParam) {
    for (const c of cityParam.split(",").filter(Boolean)) facets.cities.add(c);
  }

  const certParam = sp.get("cert");
  if (certParam) {
    for (const c of certParam.split(",").filter(Boolean)) facets.certs.add(c);
  }

  facets.verifiedOnly = sp.get("verified") === "1";

  const ratingRaw = Number(sp.get("rating"));
  facets.minRating =
    Number.isFinite(ratingRaw) && ratingRaw >= 0 && ratingRaw <= 5 ? ratingRaw : 0;

  return {
    query: sp.get("q") ?? "",
    facets,
    selectedId: sp.get("sel"),
  };
}

export function writeUrlState(s: UrlState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.query) p.set("q", s.query);
  if (s.facets.statuses.size > 0)
    p.set("status", [...s.facets.statuses].sort().join(","));
  if (s.facets.cities.size > 0) p.set("city", [...s.facets.cities].sort().join(","));
  if (s.facets.certs.size > 0) p.set("cert", [...s.facets.certs].sort().join(","));
  if (s.facets.verifiedOnly) p.set("verified", "1");
  if (s.facets.minRating > 0) p.set("rating", String(s.facets.minRating));
  if (s.selectedId) p.set("sel", s.selectedId);
  return p;
}
