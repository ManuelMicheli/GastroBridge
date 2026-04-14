export type CatalogRow = {
  id: string;
  restaurant_id: string;
  supplier_name: string;
  delivery_days: number | null;
  min_order_amount: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CatalogItemRow = {
  id: string;
  catalog_id: string;
  product_name: string;
  product_name_normalized: string;
  unit: string;
  price: number;
  notes: string | null;
  created_at: string;
};

export type CatalogWithItems = CatalogRow & {
  items: CatalogItemRow[];
};

export type ImportMode = "replace" | "append";

export type ImportRow = {
  product_name: string;
  unit: string;
  price: number;
  notes?: string | null;
};
