// app/(supplier)/supplier/ordini/_lib/url-state.ts
//
// Client-side URL ↔ state sync for the Command Timeline view.
// Piggybacks onto the existing server-driven params (state, restaurant,
// from, to) used by page.tsx, plus a client-only `sel` (peek selection).

export type SupplierOrdersUrlState = {
  statuses: Set<string>;
  query: string;
  selectedId: string | null;
  from: string;
  to: string;
};

export function readUrlState(sp: URLSearchParams): SupplierOrdersUrlState {
  const statuses = new Set<string>();
  const singleState = sp.get("state");
  if (singleState) statuses.add(singleState);
  const multiStatus = sp.get("status");
  if (multiStatus) {
    for (const s of multiStatus.split(",").filter(Boolean)) {
      statuses.add(s);
    }
  }
  return {
    statuses,
    query: sp.get("q") ?? sp.get("restaurant") ?? "",
    selectedId: sp.get("sel"),
    from: sp.get("from") ?? "",
    to: sp.get("to") ?? "",
  };
}

export function writeUrlState(s: SupplierOrdersUrlState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.statuses.size > 0) p.set("status", [...s.statuses].sort().join(","));
  if (s.query) p.set("q", s.query);
  if (s.selectedId) p.set("sel", s.selectedId);
  if (s.from) p.set("from", s.from);
  if (s.to) p.set("to", s.to);
  return p;
}
