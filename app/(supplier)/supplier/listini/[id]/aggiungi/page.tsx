import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddProductsClient } from "./add-products-client";
import type { Database } from "@/types/database";

type PriceListDb = Database["public"]["Tables"]["price_lists"]["Row"];

export const metadata: Metadata = { title: "Aggiungi prodotti al listino" };

export type AddCandidate = {
  product_id: string;
  product_name: string;
  product_brand: string | null;
  sales_unit_id: string;
  sales_unit_label: string;
  sales_unit_is_base: boolean;
  suggested_price: number;
};

export default async function AddProductsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: list } = await supabase
    .from("price_lists")
    .select("*")
    .eq("id", id)
    .maybeSingle<PriceListDb>();
  if (!list) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("profile_id", user?.id ?? "")
    .maybeSingle<{ id: string }>();
  if (!supplier?.id || supplier.id !== list.supplier_id) notFound();

  // Existing (product_id, sales_unit_id) pairs in this list
  const { data: existing } = await supabase
    .from("price_list_items")
    .select("product_id, sales_unit_id")
    .eq("price_list_id", id)
    .returns<Array<{ product_id: string; sales_unit_id: string }>>();

  const existingSet = new Set(
    (existing ?? []).map((e) => `${e.product_id}::${e.sales_unit_id}`),
  );

  // Default list (for suggested prices)
  const { data: defaultList } = await supabase
    .from("price_lists")
    .select("id")
    .eq("supplier_id", supplier.id)
    .eq("is_default", true)
    .maybeSingle<{ id: string }>();

  type ProductRow = {
    id: string;
    name: string;
    brand: string | null;
    price: number;
  };
  type UnitRow = {
    id: string;
    product_id: string;
    label: string;
    is_base: boolean;
    is_active: boolean;
    sort_order: number;
  };

  const { data: products } = await supabase
    .from("products")
    .select("id, name, brand, price")
    .eq("supplier_id", supplier.id)
    .eq("is_available", true)
    .returns<ProductRow[]>();

  const productsArr = products ?? [];
  const productIds = productsArr.map((p) => p.id);

  let units: UnitRow[] = [];
  if (productIds.length > 0) {
    const { data: unitRows } = await supabase
      .from("product_sales_units")
      .select("id, product_id, label, is_base, is_active, sort_order")
      .in("product_id", productIds)
      .eq("is_active", true)
      .returns<UnitRow[]>();
    units = unitRows ?? [];
  }

  // default-list prices map for (product_id, sales_unit_id) -> price
  const defaultPriceMap = new Map<string, number>();
  if (defaultList?.id) {
    const { data: defItems } = await supabase
      .from("price_list_items")
      .select("product_id, sales_unit_id, price")
      .eq("price_list_id", defaultList.id)
      .returns<
        Array<{ product_id: string; sales_unit_id: string; price: number }>
      >();
    for (const it of defItems ?? []) {
      defaultPriceMap.set(
        `${it.product_id}::${it.sales_unit_id}`,
        Number(it.price),
      );
    }
  }

  const productMap = new Map(productsArr.map((p) => [p.id, p]));

  const candidates: AddCandidate[] = units
    .filter(
      (u) => !existingSet.has(`${u.product_id}::${u.id}`),
    )
    .map((u) => {
      const p = productMap.get(u.product_id);
      if (!p) return null;
      const key = `${u.product_id}::${u.id}`;
      const suggested =
        defaultPriceMap.get(key) ?? (u.is_base ? Number(p.price) : 0);
      return {
        product_id: u.product_id,
        product_name: p.name,
        product_brand: p.brand,
        sales_unit_id: u.id,
        sales_unit_label: u.label,
        sales_unit_is_base: u.is_base,
        suggested_price: suggested,
      };
    })
    .filter((x): x is AddCandidate => x !== null)
    .sort((a, b) => {
      const nd = a.product_name.localeCompare(b.product_name, "it");
      if (nd !== 0) return nd;
      return a.sales_unit_label.localeCompare(b.sales_unit_label, "it");
    });

  return (
    <div>
      <div className="mb-4">
        <Link
          href={`/supplier/listini/${list.id}`}
          className="text-sm text-text-secondary hover:text-text-primary"
        >
          ← Torna all&apos;editor
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-text-primary mb-1">
        Aggiungi prodotti
      </h1>
      <p className="text-sm text-text-secondary mb-6">
        Listino: <span className="text-text-primary">{list.name}</span>
      </p>
      <AddProductsClient listId={list.id} candidates={candidates} />
    </div>
  );
}
