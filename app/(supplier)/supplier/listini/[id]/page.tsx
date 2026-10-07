import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PriceListEditorClient } from "./price-list-editor-client";
import {
  ListinoCustomers,
  type AssignableCustomer,
  type ListinoCustomer,
} from "./listino-customers";
import type { Database } from "@/types/database";
import type { EditorRow } from "@/components/supplier/pricing/types";
import { getCurrentSupplierMember, memberCan } from "@/lib/supplier/current-member";

type PriceListRow = Database["public"]["Tables"]["price_lists"]["Row"];
type PriceListItemRow =
  Database["public"]["Tables"]["price_list_items"]["Row"];

export const metadata: Metadata = { title: "Editor listino" };

type ProductInfo = {
  id: string;
  name: string;
  brand: string | null;
  category_id: string;
};
type SalesUnitInfo = {
  id: string;
  product_id: string;
  label: string;
  is_base: boolean;
};

export default async function PriceListEditorPage({
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
    .maybeSingle<PriceListRow>();

  if (!list) notFound();

  // Verify ownership
  const member = await getCurrentSupplierMember();
  const supplier = member ? { id: member.supplier_id } : null;
  // Same gate as the sidebar (lib/supplier/permissions.ts ROLE_MATRIX).
  if (member && !memberCan(member, "pricing.read")) redirect("/supplier/dashboard");

  if (!supplier?.id || supplier.id !== list.supplier_id) {
    notFound();
  }

  const { data: items } = await supabase
    .from("price_list_items")
    .select("*")
    .eq("price_list_id", id)
    .returns<PriceListItemRow[]>();

  const itemsArr = items ?? [];
  const productIds = Array.from(new Set(itemsArr.map((i) => i.product_id)));
  const unitIds = Array.from(new Set(itemsArr.map((i) => i.sales_unit_id)));

  let products: ProductInfo[] = [];
  let units: SalesUnitInfo[] = [];

  if (productIds.length > 0) {
    const { data: prodRows } = await supabase
      .from("products")
      .select("id, name, brand, category_id")
      .in("id", productIds)
      .returns<ProductInfo[]>();
    products = prodRows ?? [];
  }

  if (unitIds.length > 0) {
    const { data: unitRows } = await supabase
      .from("product_sales_units")
      .select("id, product_id, label, is_base")
      .in("id", unitIds)
      .returns<SalesUnitInfo[]>();
    units = unitRows ?? [];
  }

  const productMap = new Map(products.map((p) => [p.id, p]));
  const unitMap = new Map(units.map((u) => [u.id, u]));

  const rows: EditorRow[] = itemsArr
    .map((it) => {
      const p = productMap.get(it.product_id);
      const u = unitMap.get(it.sales_unit_id);
      return {
        id: it.id,
        price_list_id: it.price_list_id,
        product_id: it.product_id,
        sales_unit_id: it.sales_unit_id,
        price: Number(it.price),
        product_name: p?.name ?? "(prodotto eliminato)",
        product_brand: p?.brand ?? null,
        sales_unit_label: u?.label ?? "—",
        sales_unit_is_base: u?.is_base ?? false,
      };
    })
    .sort((a, b) => {
      const nameDiff = a.product_name.localeCompare(b.product_name, "it");
      if (nameDiff !== 0) return nameDiff;
      return a.sales_unit_label.localeCompare(b.sales_unit_label, "it");
    });

  // Count how many supplier products are NOT yet in the list (for "Aggiungi prodotto" CTA badge)
  const { count: totalProducts } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", supplier.id);

  const missingCount = Math.max(
    0,
    (totalProducts ?? 0) - productIds.length,
  );

  // Clients assigned to this list + active clients that can be assigned.
  const [{ data: assignmentRows }, { data: relRows }] = await Promise.all([
    supabase
      .from("customer_price_assignments")
      .select("restaurant_id, price_list_id, price_lists(name)")
      .eq("supplier_id", supplier.id)
      .returns<{ restaurant_id: string; price_list_id: string; price_lists: { name: string } | null }[]>(),
    supabase
      .from("restaurant_suppliers")
      .select("id, restaurant_id, status, restaurants(name)")
      .eq("supplier_id", supplier.id)
      .in("status", ["active", "paused"])
      .returns<{ id: string; restaurant_id: string; status: string; restaurants: { name: string } | null }[]>(),
  ]);
  const listByRestaurant = new Map(
    (assignmentRows ?? []).map((a) => [a.restaurant_id, a]),
  );
  const relByRestaurant = new Map((relRows ?? []).map((r) => [r.restaurant_id, r]));
  const assigned: ListinoCustomer[] = (assignmentRows ?? [])
    .filter((a) => a.price_list_id === list.id)
    .map((a) => {
      const rel = relByRestaurant.get(a.restaurant_id);
      return {
        restaurantId: a.restaurant_id,
        name: rel?.restaurants?.name ?? "Cliente",
        relationshipId: rel?.id ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "it"));
  const assignable: AssignableCustomer[] = (relRows ?? [])
    .filter((r) => listByRestaurant.get(r.restaurant_id)?.price_list_id !== list.id)
    .map((r) => ({
      restaurantId: r.restaurant_id,
      name: r.restaurants?.name ?? "Cliente",
      relationshipId: r.id,
      currentListName: listByRestaurant.get(r.restaurant_id)?.price_lists?.name ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "it"));

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/supplier/listini"
          className="text-sm text-text-secondary hover:text-text-primary"
        >
          ← Tutti i listini
        </Link>
      </div>
      <PriceListEditorClient
        list={list}
        initialRows={rows}
        missingProductsCount={missingCount}
      />
      <ListinoCustomers
        supplierId={supplier.id}
        priceListId={list.id}
        canEdit={memberCan(member, "pricing.edit")}
        assigned={assigned}
        assignable={assignable}
      />
    </div>
  );
}
