// app/(app)/ordini/_lib/types.ts
//
// Shared types for the /ordini Command Timeline redesign.
//
// Rows are shaped by the server component (page.tsx) from `orders` joined
// with `order_splits(subtotal, suppliers(company_name))`. Since `orders`
// has no direct `supplier_id` column, we derive a display name from the
// first split (alphabetically) plus an extra-count badge when an order
// spans multiple suppliers.

export type OrderStatus =
  | "draft"
  | "submitted"
  | "pending"
  | "pending_confirmation"
  | "confirmed"
  | "preparing"
  | "in_transit"
  | "shipping"
  | "shipped"
  | "delivered"
  | "completed"
  | "cancelled";

export type OrderFeedRow = {
  id: string;
  total: number;
  status: string; // kept as string for DB flexibility; mapped via helpers
  notes: string | null;
  createdAt: string; // ISO timestamp
  supplierName: string | null; // first split's supplier, or null
  supplierCount: number; // number of distinct suppliers on the order (≥1 when splits exist, 0 when none)
};

export type OrderStats = {
  totalCount: number;
  monthTotal: number; // sum of `total` for orders in the current month
  statusCounts: Record<string, number>;
};

export type TimeBucket = "today" | "yesterday" | "this_week" | "earlier";

export type BucketedFeed = {
  bucket: TimeBucket;
  rows: OrderFeedRow[];
}[];
