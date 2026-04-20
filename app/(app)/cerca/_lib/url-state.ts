// app/(app)/cerca/_lib/url-state.ts
import type { FacetState } from "./facets";

export type Tab = "ricerca" | "ordine" | "solito";

export type UrlState = {
  tab: Tab;
  query: string;
  facets: FacetState;
  selectedKey: string | null;
};

const parseSet = (s: string | null): Set<string> => {
  if (!s) return new Set();
  return new Set(s.split(",").map((v) => decodeURIComponent(v)).filter(Boolean));
};

const encodeSet = (s: Set<string>): string =>
  Array.from(s).map(encodeURIComponent).join(",");

export function readUrlState(sp: URLSearchParams): UrlState {
  const tabRaw = sp.get("tab");
  const tab: Tab =
    tabRaw === "ordine" ? "ordine" : tabRaw === "solito" ? "solito" : "ricerca";

  const minN = Number(sp.get("min"));
  const maxN = Number(sp.get("max"));
  const priceRange: [number, number] | null =
    Number.isFinite(minN) && Number.isFinite(maxN) && maxN > 0
      ? [minN, maxN]
      : null;

  const scoreN = Number(sp.get("score"));
  const minScore = Number.isFinite(scoreN) ? Math.max(0, Math.min(100, scoreN)) : 0;

  return {
    tab,
    query: sp.get("q") ?? "",
    selectedKey: sp.get("sel"),
    facets: {
      units: parseSet(sp.get("units")),
      supplierIds: parseSet(sp.get("suppliers")),
      categories: parseSet(sp.get("cats")),
      priceRange,
      minScore,
      bioOnly: sp.get("bio") === "1",
      certs: parseSet(sp.get("certs")),
    },
  };
}

export function writeUrlState(state: UrlState): URLSearchParams {
  const sp = new URLSearchParams();
  if (state.tab !== "ricerca") sp.set("tab", state.tab);
  if (state.query) sp.set("q", state.query);
  if (state.facets.units.size) sp.set("units", encodeSet(state.facets.units));
  if (state.facets.supplierIds.size) sp.set("suppliers", encodeSet(state.facets.supplierIds));
  if (state.facets.categories.size) sp.set("cats", encodeSet(state.facets.categories));
  if (state.facets.priceRange) {
    sp.set("min", String(state.facets.priceRange[0]));
    sp.set("max", String(state.facets.priceRange[1]));
  }
  if (state.facets.minScore > 0) sp.set("score", String(state.facets.minScore));
  if (state.facets.bioOnly) sp.set("bio", "1");
  if (state.facets.certs.size) sp.set("certs", encodeSet(state.facets.certs));
  if (state.selectedKey) sp.set("sel", state.selectedKey);
  return sp;
}
