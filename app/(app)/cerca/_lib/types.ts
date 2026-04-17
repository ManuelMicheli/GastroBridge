// app/(app)/cerca/_lib/types.ts
import type { ScoredOffer } from "@/lib/scoring";

export type SupplierLite = {
  id: string;
  supplier_name: string;
  delivery_days: number | null;
  min_order_amount: number | null;
};

export type CatalogItemLite = {
  id: string;
  catalog_id: string;
  product_name: string;
  product_name_normalized: string;
  unit: string;
  price: number;
  notes: string | null;
};

export type RankedOffer = {
  scored: ScoredOffer;
  supplier: SupplierLite;
  itemId: string;
  price: number;
};

export type Group = {
  key: string;
  productName: string;
  unit: string;
  offers: RankedOffer[];
  averagePrice: number;
};

export type OrderLine = {
  key: string;
  productName: string;
  unit: string;
  qty: number;
};
