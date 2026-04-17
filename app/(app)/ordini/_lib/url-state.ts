// app/(app)/ordini/_lib/url-state.ts
//
// URL ↔ state sync for the Command Timeline.
// Params: ?status=pending,confirmed&q=text&sel=<orderId>

export type OrdersUrlState = {
  statuses: Set<string>;
  query: string;
  selectedId: string | null;
};

export function readUrlState(sp: URLSearchParams): OrdersUrlState {
  const statuses = new Set<string>();
  const statusParam = sp.get("status");
  if (statusParam) {
    for (const s of statusParam.split(",").filter(Boolean)) {
      statuses.add(s);
    }
  }
  return {
    statuses,
    query: sp.get("q") ?? "",
    selectedId: sp.get("sel"),
  };
}

export function writeUrlState(s: OrdersUrlState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.statuses.size > 0) p.set("status", [...s.statuses].sort().join(","));
  if (s.query) p.set("q", s.query);
  if (s.selectedId) p.set("sel", s.selectedId);
  return p;
}
