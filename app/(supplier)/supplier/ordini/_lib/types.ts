// app/(supplier)/supplier/ordini/_lib/types.ts
//
// Supplier ordini Command Timeline types. Rows are split-scoped: each
// entry represents one `order_splits` row for the current supplier.

export type SupplierTimelineRow = {
  splitId: string;
  orderId: string;
  orderNumber: string | null;
  restaurantName: string;
  zoneName: string | null;
  createdAt: string;
  expectedDeliveryDate: string | null;
  subtotal: number;
  workflowState: string;
  rawStatus: string;
};

export type TimeBucket = "today" | "yesterday" | "this_week" | "earlier";

export type BucketedSupplierFeed = {
  bucket: TimeBucket;
  rows: SupplierTimelineRow[];
}[];

export type SupplierOrderStats = {
  totalCount: number;
  monthTotal: number;
  statusCounts: Record<string, number>;
};
