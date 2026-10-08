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
import { applyDueScheduledChanges, type ScheduledChange } from "@/lib/supplier/pricing/scheduled-core";
import { getListMargins } from "@/lib/supplier/pricing/margins";
import { MarginsCard, ScheduledChangesCard, type MarginRow, type ScheduledChangeView } from "./price-intel";

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

  // Due scheduled price changes are applied lazily by anyone allowed to edit
  // prices (the cron route covers unattended days).
  const canEditPrices = memberCan(member, "pricing.edit");
  if (canEditPrices) {
    await applyDueScheduledChanges(supabase, supplier.id).catch(() => null);
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

  // Scheduled changes of this list (table absent until the migration is applied).
  const { data: changeRows, error: changesErr } = (await (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table added by 20261009000000, not in generated types
    supabase as any
  )
    .from("scheduled_price_changes")
    .select("id, supplier_id, price_list_id, category_id, mode, value, effective_date, status, note, notify_clients, notified_at, applied_at, applied_count, created_at")
    .eq("price_list_id", id)
    .order("effective_date", { ascending: false })
    .limit(30)) as { data: ScheduledChange[] | null; error: unknown };
  const categoryIds = Array.from(new Set(products.map((p) => p.category_id).filter(Boolean)));
  const { data: catRows } = categoryIds.length
    ? await supabase.from("categories").select("id, name").in("id", categoryIds).returns<{ id: string; name: string }[]>()
    : { data: [] as { id: string; name: string }[] };
  const catName = new Map((catRows ?? []).map((c) => [c.id, c.name]));
  const changes: ScheduledChangeView[] = (changeRows ?? []).map((c) => ({
    id: c.id,
    categoryName: c.category_id ? catName.get(c.category_id) ?? "Categoria" : null,
    mode: c.mode,
    value: Number(c.value),
    effectiveDate: c.effective_date,
    status: c.status,
    note: c.note,
    notifiedAt: c.notified_at,
    appliedCount: c.applied_count,
  }));

  // Margins vs. purchase cost (financial roles only).
  let marginRows: MarginRow[] | null = null;
  if (memberCan(member, "analytics.financial")) {
    const margins = await getListMargins(
      supabase,
      itemsArr.map((it) => ({ id: it.id, product_id: it.product_id, sales_unit_id: it.sales_unit_id, price: Number(it.price) })),
    );
    marginRows = margins.map((m) => {
      const row = rows.find((r) => r.id === m.itemId);
      return {
        itemId: m.itemId,
        productName: row?.product_name ?? "Prodotto",
        unitLabel: row?.sales_unit_label ?? "—",
        price: m.price,
        unitCost: m.unitCost,
        marginPct: m.marginPct,
        costBasis: m.costBasis,
      };
    });
  }

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
      <ScheduledChangesCard
        priceListId={list.id}
        categories={(catRows ?? []).sort((a, b) => a.name.localeCompare(b.name, "it"))}
        changes={changes}
        canEdit={canEditPrices}
        available={!changesErr}
      />
      {marginRows && <MarginsCard rows={marginRows} />}
    </div>
  );
}
