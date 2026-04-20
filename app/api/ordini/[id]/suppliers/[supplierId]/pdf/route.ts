import "server-only";

import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";

import { createClient } from "@/lib/supabase/server";
import {
  OrderPdfDocument,
  type OrderPdfData,
  type OrderPdfLine,
  type OrderPdfParty,
} from "@/components/restaurant/order/order-pdf-document";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  restaurant_id: string;
  created_at: string;
  notes: string | null;
};

type SplitRow = {
  id: string;
  subtotal: number;
  expected_delivery_date: string | null;
};

type SupplierRow = {
  company_name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  zip_code: string | null;
  phone: string | null;
  email: string | null;
  fiscal_code: string | null;
};

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

type ProfileRow = {
  company_name: string;
  vat_number: string | null;
};

type ItemRow = {
  id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes: string | null;
  products: { name: string; unit: string } | { name: string; unit: string }[] | null;
};

function shortOrderId(id: string): string {
  return `ORD-${id.slice(-4).toUpperCase()}`;
}

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; supplierId: string }> },
) {
  const { id: orderId, supplierId } = await params;
  const supabase = await createClient();

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, restaurant_id, created_at, notes")
    .eq("id", orderId)
    .maybeSingle<OrderRow>();
  if (orderErr) {
    return NextResponse.json({ error: orderErr.message }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ error: "order not found" }, { status: 404 });
  }

  const [
    { data: split },
    { data: supplier, error: supErr },
    { data: restaurant, error: resErr },
    { data: items, error: itemsErr },
  ] = await Promise.all([
    supabase
      .from("order_splits")
      .select("id, subtotal, expected_delivery_date")
      .eq("order_id", orderId)
      .eq("supplier_id", supplierId)
      .maybeSingle<SplitRow>(),
    supabase
      .from("suppliers")
      .select(
        "company_name, address, city, province, zip_code, phone, email, fiscal_code",
      )
      .eq("id", supplierId)
      .maybeSingle<SupplierRow>(),
    supabase
      .from("restaurants")
      .select(
        "name, profile_id, address, city, province, zip_code, phone, email",
      )
      .eq("id", order.restaurant_id)
      .maybeSingle<RestaurantRow>(),
    supabase
      .from("order_items")
      .select("id, quantity, unit_price, subtotal, notes, products(name, unit)")
      .eq("order_id", orderId)
      .eq("supplier_id", supplierId)
      .returns<ItemRow[]>(),
  ]);

  if (supErr || resErr || itemsErr) {
    return NextResponse.json(
      { error: supErr?.message ?? resErr?.message ?? itemsErr?.message },
      { status: 500 },
    );
  }
  if (!supplier) {
    return NextResponse.json({ error: "supplier not found" }, { status: 404 });
  }
  if (!restaurant) {
    return NextResponse.json(
      { error: "restaurant not found" },
      { status: 404 },
    );
  }
  if (!items || items.length === 0) {
    return NextResponse.json(
      { error: "nessun articolo per questo fornitore in questo ordine" },
      { status: 404 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_name, vat_number")
    .eq("id", restaurant.profile_id)
    .maybeSingle<ProfileRow>();

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

  const supplierParty: OrderPdfParty = {
    name: supplier.company_name,
    fiscal_code: supplier.fiscal_code,
    address: supplier.address,
    city: supplier.city,
    province: supplier.province,
    postal_code: supplier.zip_code,
    phone: supplier.phone,
    email: supplier.email,
  };

  const lines: OrderPdfLine[] = items.map((row, idx) => {
    const product = pickOne(row.products);
    return {
      position: idx + 1,
      product_name: product?.name ?? "(prodotto)",
      unit: product?.unit ?? "pz",
      quantity: Number(row.quantity),
      unit_price: Number(row.unit_price),
      subtotal: Number(row.subtotal),
      notes: row.notes,
    };
  });

  const itemsSubtotal = lines.reduce((s, l) => s + l.subtotal, 0);

  const data: OrderPdfData = {
    order_id: order.id,
    order_short_id: shortOrderId(order.id),
    issued_at: order.created_at,
    expected_delivery_date: split?.expected_delivery_date ?? null,
    restaurant: restaurantParty,
    supplier: supplierParty,
    lines,
    subtotal: split ? Number(split.subtotal) : itemsSubtotal,
    order_notes: order.notes,
  };

  const pdfBuffer = (await renderToBuffer(
    OrderPdfDocument(data),
  )) as unknown as Buffer;

  const safeSupplier = supplier.company_name
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "fornitore";
  const filename = `${data.order_short_id}-${safeSupplier}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
