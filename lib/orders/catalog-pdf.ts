// PDF of one supplier block of a private-catalog order (header-only order,
// lines in orders.notes). Shared by the download route and the email channel.

import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import {
  OrderPdfDocument,
  type OrderPdfData,
  type OrderPdfLine,
  type OrderPdfParty,
} from "@/components/restaurant/order/order-pdf-document";

export type CatalogBlock = {
  supplierName: string;
  subtotalLabel: string;
  items: { qty: string; name: string; price: string }[];
};

export function parseCatalogOrderBlocks(notes: string): CatalogBlock[] {
  const lines = notes.split(/\r?\n/);
  const blocks: CatalogBlock[] = [];
  let current: CatalogBlock | null = null;
  for (const line of lines) {
    const h = line.match(/^---\s*(.+?)\s*\((.+?)\)\s*---$/);
    if (h) {
      current = { supplierName: h[1]!, subtotalLabel: h[2]!, items: [] };
      blocks.push(current);
      continue;
    }
    const it = line.match(/^\s{2,}(\S+?)×\s*(.+?)\s*@\s*(.+)$/);
    if (it && current) {
      current.items.push({ qty: it[1]!, name: it[2]!, price: it[3]! });
    }
  }
  return blocks;
}

export function parseEur(s: string): number {
  const cleaned = s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function parseQty(s: string): number {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 1;
}

export function shortOrderId(id: string): string {
  return `ORD-${id.slice(-4).toUpperCase()}`;
}

type OrderRow = { id: string; restaurant_id: string; created_at: string; notes: string | null };
type RestaurantRow = {
  name: string;
  profile_id: string;
  address: string | null;
  city: string | null;
  province: string | null;
  zip_code: string | null;
  phone: string | null;
  email: string | null;
};

export type CatalogBlockPdf = {
  buffer: Buffer;
  filename: string;
  block: CatalogBlock;
  order: OrderRow;
  restaurant: RestaurantRow & { displayName: string };
};

export type CatalogBlockPdfError = { status: number; error: string };

/** Render the PDF with the caller's RLS (owner / team member of the order's restaurant). */
export async function buildCatalogBlockPdf(
  orderId: string,
  supplierIdx: number,
): Promise<CatalogBlockPdf | CatalogBlockPdfError> {
  if (!Number.isInteger(supplierIdx) || supplierIdx < 0) return { status: 400, error: "idx non valido" };
  const supabase = await createClient();

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, restaurant_id, created_at, notes")
    .eq("id", orderId)
    .maybeSingle<OrderRow>();
  if (orderErr || !order) return { status: 404, error: "order not found" };
  if (!order.notes) return { status: 404, error: "ordine senza dettaglio catalogo" };

  const block = parseCatalogOrderBlocks(order.notes)[supplierIdx];
  if (!block) return { status: 404, error: "fornitore non trovato nell'ordine" };

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("name, profile_id, address, city, province, zip_code, phone, email")
    .eq("id", order.restaurant_id)
    .maybeSingle<RestaurantRow>();
  if (!restaurant) return { status: 404, error: "restaurant not found" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_name, vat_number")
    .eq("id", restaurant.profile_id)
    .maybeSingle<{ company_name: string; vat_number: string | null }>();

  const restaurantParty: OrderPdfParty = {
    name: profile?.company_name || restaurant.name,
    vat: profile?.vat_number ?? null,
    address: restaurant.address,
    city: restaurant.city,
    province: restaurant.province,
    postal_code: restaurant.zip_code,
    phone: restaurant.phone,
    email: restaurant.email,
  };

  const lines: OrderPdfLine[] = block.items.map((it, i) => {
    const quantity = parseQty(it.qty);
    const unit_price = parseEur(it.price);
    return {
      position: i + 1,
      product_name: it.name,
      unit: "",
      quantity,
      unit_price,
      subtotal: Number((quantity * unit_price).toFixed(2)),
      notes: null,
    };
  });

  const subtotal = parseEur(block.subtotalLabel) || lines.reduce((s, l) => s + l.subtotal, 0);

  const data: OrderPdfData = {
    order_id: order.id,
    order_short_id: shortOrderId(order.id),
    issued_at: order.created_at,
    expected_delivery_date: null,
    restaurant: restaurantParty,
    supplier: { name: block.supplierName },
    lines,
    subtotal,
    order_notes: null,
  };

  const buffer = (await renderToBuffer(OrderPdfDocument(data))) as unknown as Buffer;
  const safeSupplier =
    block.supplierName
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "fornitore";

  return {
    buffer,
    filename: `${data.order_short_id}-${safeSupplier}.pdf`,
    block,
    order,
    restaurant: { ...restaurant, displayName: restaurantParty.name },
  };
}
