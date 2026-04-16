export type PriceListRow = {
  id: string;
  relationship_id: string;
  product_id: string;
  custom_price: number;
  custom_min_qty: number | null;
  valid_from: string | null;
  valid_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PriceListWithProduct = PriceListRow & {
  product: {
    id: string;
    name: string;
    unit: string | null;
    price: number | null;
  } | null;
};

export type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };
