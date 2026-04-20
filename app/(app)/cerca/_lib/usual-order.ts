// app/(app)/cerca/_lib/usual-order.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UnitType } from "@/types/database";

export const USUAL_ORDER_WINDOW_DAYS = 60;
export const USUAL_ORDER_MIN_TIMES = 2;
export const USUAL_ORDER_MAX_ITEMS = 20;

export type UsualOrderItem = {
  productId: string;
  productName: string;
  brand: string | null;
  unit: UnitType;
  supplierId: string;
  supplierName: string;
  price: number;
  imageUrl: string | null;
  minQuantity: number;
  timesOrdered: number;
  totalQty: number;
  avgQty: number;
  lastOrderedAt: string;
};

type OrderItemRow = {
  quantity: number;
  unit_price: number;
  product_id: string;
  supplier_id: string;
  orders: { created_at: string } | null;
  products: {
    name: string;
    brand: string | null;
    unit: UnitType;
    image_url: string | null;
    min_quantity: number | null;
  } | null;
  suppliers: { company_name: string } | null;
};

export async function loadUsualOrder(
  supabase: SupabaseClient,
  restaurantIds: string[],
): Promise<UsualOrderItem[]> {
  if (restaurantIds.length === 0) return [];

  const since = new Date();
  since.setDate(since.getDate() - USUAL_ORDER_WINDOW_DAYS);

  const { data: orders } = await supabase
    .from("orders")
    .select("id")
    .in("restaurant_id", restaurantIds)
    .gte("created_at", since.toISOString())
    .returns<Array<{ id: string }>>();

  const orderIds = (orders ?? []).map((o) => o.id);
  if (orderIds.length === 0) return [];

  const { data } = await supabase
    .from("order_items")
    .select(`
      quantity,
      unit_price,
      product_id,
      supplier_id,
      orders!inner(created_at),
      products(name, brand, unit, image_url, min_quantity),
      suppliers(company_name)
    `)
    .in("order_id", orderIds)
    .returns<OrderItemRow[]>();

  type Acc = {
    productId: string;
    productName: string;
    brand: string | null;
    unit: UnitType;
    supplierId: string;
    supplierName: string;
    price: number;
    imageUrl: string | null;
    minQuantity: number;
    timesOrdered: number;
    totalQty: number;
    lastOrderedAt: string;
  };

  const byProduct = new Map<string, Acc>();
  for (const r of data ?? []) {
    if (!r.products || !r.suppliers || !r.orders) continue;
    const createdAt = r.orders.created_at;
    const existing = byProduct.get(r.product_id);
    if (existing) {
      existing.timesOrdered += 1;
      existing.totalQty += Number(r.quantity);
      if (createdAt > existing.lastOrderedAt) {
        existing.lastOrderedAt = createdAt;
        existing.price = Number(r.unit_price);
      }
    } else {
      byProduct.set(r.product_id, {
        productId: r.product_id,
        productName: r.products.name,
        brand: r.products.brand,
        unit: r.products.unit,
        supplierId: r.supplier_id,
        supplierName: r.suppliers.company_name,
        price: Number(r.unit_price),
        imageUrl: r.products.image_url,
        minQuantity: Number(r.products.min_quantity ?? 1),
        timesOrdered: 1,
        totalQty: Number(r.quantity),
        lastOrderedAt: createdAt,
      });
    }
  }

  return Array.from(byProduct.values())
    .filter((a) => a.timesOrdered >= USUAL_ORDER_MIN_TIMES)
    .map((a) => ({
      ...a,
      avgQty: a.totalQty / a.timesOrdered,
    }))
    .sort((a, b) => {
      if (a.timesOrdered !== b.timesOrdered) return b.timesOrdered - a.timesOrdered;
      if (a.totalQty !== b.totalQty) return b.totalQty - a.totalQty;
      return b.lastOrderedAt.localeCompare(a.lastOrderedAt);
    })
    .slice(0, USUAL_ORDER_MAX_ITEMS);
}
