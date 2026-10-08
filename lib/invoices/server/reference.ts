// lib/invoices/server/reference.ts
// Load everything the reconciliation needs for one restaurant and a date
// window: connected suppliers (+ their P.IVA), private catalogs, confirmed
// P.IVA links, marketplace and catalog orders with lines, DDT numbers,
// received quantities (delivery check-in, when that feature is deployed),
// catalog / listino prices and previously imported invoices.
//
// Reads use the service-role client SCOPED TO `restaurantId`: callers must
// have authorized the user on that restaurant (getFinanceAccess) or be a
// trusted server job (webhook / cron). Some sources (supplier DDT documents,
// supplier profiles' P.IVA, unavailable products) are not readable by the
// restaurant under RLS, but belong to the restaurant's own orders.

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCatalogOrderNotes } from "../catalog-orders.ts";
import { normalizeVat } from "../fatturapa.ts";
import {
  priceKeyForCatalog,
  priceKeyForProduct,
  type CandidateOrder,
  type CandidateOrderLine,
  type ExistingInvoiceRef,
  type PriceListEntry,
} from "../match.ts";
import { companySimilarity, normalizeText, productSimilarity } from "../text.ts";
import { chunks, rows, type Db } from "./db";

export interface ConnectedSupplier {
  supplierId: string;
  relationshipId: string;
  name: string;
  vats: string[];
}

export interface CatalogRef {
  id: string;
  supplierName: string;
  supplierId: string | null;
  relationshipId: string | null;
}

interface SupplierOrderGroup extends CandidateOrder {
  supplierId: string;
}

interface CatalogOrderGroup extends CandidateOrder {
  supplierName: string;
}

export interface ReferenceData {
  restaurantId: string;
  suppliers: ConnectedSupplier[];
  catalogs: CatalogRef[];
  links: Map<string, { supplierId: string | null; catalogId: string | null; source: string }>;
  supplierOrders: SupplierOrderGroup[];
  catalogOrders: CatalogOrderGroup[];
  catalogItems: Map<string, Array<{ name: string; unit: string; price: number }>>;
  supplierProducts: Map<string, PriceListEntry[]>;
  existing: ExistingInvoiceRef[];
  alreadyInvoiced: Set<string>;
  receivingAvailable: boolean;
}

type OrderRow = { id: string; created_at: string; status: string; notes: string | null };
type ItemRow = { id: string; order_id: string; product_id: string; supplier_id: string; quantity: number; unit_price: number };
type ProductRow = {
  id: string;
  supplier_id?: string;
  name: string;
  sku: string | null;
  unit: string;
  price?: number;
  packaging_size: number | null;
  packaging_unit: string | null;
  tax_rate: number | null;
};
type SplitRow = { id: string; order_id: string; supplier_id: string; delivered_at: string | null; expected_delivery_date: string | null };
type ReceivedRow = {
  order_id: string;
  order_item_id: string | null;
  product_name: string;
  ordered_qty: number | null;
  received_qty: number | null;
  issue: string | null;
  ddt_number: string | null;
  received_at: string | null;
};

export async function loadReferenceData(
  restaurantId: string,
  window: { from: string; to: string },
): Promise<ReferenceData> {
  const admin = createAdminClient() as Db;

  // --- Suppliers / catalogs / links --------------------------------
  const [rels, catalogs, links] = await Promise.all([
    rows<{ id: string; supplier_id: string; supplier: { id: string; company_name: string; fiscal_code: string | null; profile_id: string } | null }>(
      admin
        .from("restaurant_suppliers")
        .select("id, supplier_id, supplier:suppliers!supplier_id (id, company_name, fiscal_code, profile_id)")
        .eq("restaurant_id", restaurantId)
        .in("status", ["active", "paused", "pending"]),
      "restaurant_suppliers",
    ),
    rows<{ id: string; supplier_name: string; supplier_id: string | null; relationship_id: string | null }>(
      admin.from("restaurant_catalogs").select("id, supplier_name, supplier_id, relationship_id").eq("restaurant_id", restaurantId),
      "restaurant_catalogs",
    ),
    rows<{ supplier_vat: string; supplier_id: string | null; catalog_id: string | null; source: string }>(
      admin.from("invoice_supplier_links").select("supplier_vat, supplier_id, catalog_id, source").eq("restaurant_id", restaurantId),
      "invoice_supplier_links",
    ),
  ]);

  const profileIds = rels.map((r) => r.supplier?.profile_id).filter((x): x is string => !!x);
  const vatByProfile = new Map<string, string>();
  for (const part of chunks(profileIds)) {
    for (const p of await rows<{ id: string; vat_number: string | null }>(admin.from("profiles").select("id, vat_number").in("id", part), "profiles")) {
      const v = normalizeVat(p.vat_number);
      if (v) vatByProfile.set(p.id, v);
    }
  }
  const suppliers: ConnectedSupplier[] = rels
    .filter((r) => r.supplier)
    .map((r) => ({
      supplierId: r.supplier_id,
      relationshipId: r.id,
      name: r.supplier!.company_name,
      vats: [vatByProfile.get(r.supplier!.profile_id), normalizeVat(r.supplier!.fiscal_code)].filter((x): x is string => !!x),
    }));

  // --- Orders in the window ---------------------------------------
  const orders = await rows<OrderRow>(
    admin
      .from("orders")
      .select("id, created_at, status, notes")
      .eq("restaurant_id", restaurantId)
      .gte("created_at", `${window.from}T00:00:00Z`)
      .lte("created_at", `${window.to}T23:59:59Z`)
      .neq("status", "draft")
      .limit(2000),
    "orders",
  );
  const orderIds = orders.map((o) => o.id);

  const items: ItemRow[] = [];
  const splits: SplitRow[] = [];
  const received: ReceivedRow[] = [];
  let receivingAvailable = false;
  for (const part of chunks(orderIds)) {
    items.push(
      ...(await rows<ItemRow>(
        admin.from("order_items").select("id, order_id, product_id, supplier_id, quantity, unit_price").in("order_id", part),
        "order_items",
      )),
    );
    splits.push(
      ...(await rows<SplitRow>(
        admin.from("order_splits").select("id, order_id, supplier_id, delivered_at, expected_delivery_date").in("order_id", part),
        "order_splits",
      )),
    );
    // Delivery check-in (restaurant receiving). The view may not exist yet.
    const rec = await admin
      .from("restaurant_received_lines")
      .select("order_id, order_item_id, product_name, ordered_qty, received_qty, issue, ddt_number, received_at")
      .in("order_id", part)
      .order("received_at", { ascending: true });
    if (!rec.error) {
      receivingAvailable = true;
      received.push(...((rec.data ?? []) as ReceivedRow[]));
    }
  }

  const productIds = [...new Set(items.map((i) => i.product_id))];
  const products = new Map<string, ProductRow>();
  for (const part of chunks(productIds)) {
    for (const p of await rows<ProductRow>(
      admin.from("products").select("id, name, sku, unit, packaging_size, packaging_unit, tax_rate").in("id", part),
      "products",
    )) {
      products.set(p.id, p);
    }
  }

  // DDT documents issued by platform suppliers for these splits.
  const ddtBySplit = new Map<string, string[]>();
  const splitIds = splits.map((s) => s.id);
  for (const part of chunks(splitIds)) {
    const deliveries = await rows<{ id: string; order_split_id: string }>(
      admin.from("deliveries").select("id, order_split_id").in("order_split_id", part),
      "deliveries",
    );
    const bySplitDelivery = new Map(deliveries.map((d) => [d.id, d.order_split_id]));
    for (const dpart of chunks(deliveries.map((d) => d.id))) {
      for (const doc of await rows<{ delivery_id: string; number: number; year: number; canceled_at: string | null }>(
        admin.from("ddt_documents").select("delivery_id, number, year, canceled_at").in("delivery_id", dpart),
        "ddt_documents",
      )) {
        if (doc.canceled_at) continue;
        const sid = bySplitDelivery.get(doc.delivery_id);
        if (!sid) continue;
        const list = ddtBySplit.get(sid) ?? [];
        list.push(String(doc.number), `${doc.number}/${doc.year}`);
        ddtBySplit.set(sid, list);
      }
    }
  }

  const receivedByItem = new Map<string, number>();
  const receivedByOrderName = new Map<string, number>();
  const ddtByOrder = new Map<string, string[]>();
  // Oldest → newest: a later check-in of the same line wins. A line checked
  // "ok" without a typed quantity was received as ordered.
  for (const r of received) {
    if (r.ddt_number) ddtByOrder.set(r.order_id, [...(ddtByOrder.get(r.order_id) ?? []), r.ddt_number]);
    const qty =
      r.received_qty !== null && r.received_qty !== undefined
        ? Number(r.received_qty)
        : r.issue === "ok" && r.ordered_qty !== null && r.ordered_qty !== undefined
          ? Number(r.ordered_qty)
          : null;
    if (qty === null) continue;
    if (r.order_item_id) receivedByItem.set(r.order_item_id, qty);
    else receivedByOrderName.set(`${r.order_id}|${normalizeText(r.product_name)}`, qty);
  }

  const orderById = new Map(orders.map((o) => [o.id, o]));
  const supplierOrders: SupplierOrderGroup[] = [];
  const groups = new Map<string, ItemRow[]>();
  for (const it of items) {
    const k = `${it.order_id}|${it.supplier_id}`;
    groups.set(k, [...(groups.get(k) ?? []), it]);
  }
  for (const [k, its] of groups) {
    const [orderId, supplierId] = k.split("|") as [string, string];
    const order = orderById.get(orderId);
    if (!order || order.status === "cancelled") continue;
    const split = splits.find((s) => s.order_id === orderId && s.supplier_id === supplierId);
    const lines: CandidateOrderLine[] = its.map((it) => {
      const p = products.get(it.product_id);
      return {
        ref: it.id,
        orderId,
        productId: it.product_id,
        priceKey: priceKeyForProduct(it.product_id),
        name: p?.name ?? "Prodotto",
        sku: p?.sku ?? null,
        unit: p?.unit ?? "pz",
        packHint: { packagingSize: p?.packaging_size ?? null, packagingUnit: p?.packaging_unit ?? null },
        quantity: Number(it.quantity),
        receivedQty: receivedByItem.has(it.id) ? receivedByItem.get(it.id)! : null,
        unitPrice: Number(it.unit_price),
        vatRate: p?.tax_rate !== null && p?.tax_rate !== undefined ? Number(p.tax_rate) : null,
      };
    });
    supplierOrders.push({
      id: orderId,
      supplierId,
      date: order.created_at.slice(0, 10),
      deliveryDate: (split?.delivered_at ?? split?.expected_delivery_date ?? null)?.slice(0, 10) ?? null,
      ddtNumbers: [...(split ? ddtBySplit.get(split.id) ?? [] : []), ...(ddtByOrder.get(orderId) ?? [])],
      lines,
    });
  }

  // --- Catalog orders (orders.notes) --------------------------------
  const catalogRefs: CatalogRef[] = catalogs.map((c) => ({
    id: c.id,
    supplierName: c.supplier_name,
    supplierId: c.supplier_id,
    relationshipId: c.relationship_id,
  }));
  const catalogItems = new Map<string, Array<{ name: string; unit: string; price: number }>>();
  for (const part of chunks(catalogRefs.map((c) => c.id), 50)) {
    for (const it of await rows<{ catalog_id: string; product_name: string; unit: string; price: number }>(
      admin.from("restaurant_catalog_items").select("catalog_id, product_name, unit, price").in("catalog_id", part).limit(10000),
      "restaurant_catalog_items",
    )) {
      const list = catalogItems.get(it.catalog_id) ?? [];
      list.push({ name: it.product_name, unit: it.unit, price: Number(it.price) });
      catalogItems.set(it.catalog_id, list);
    }
  }

  const catalogOrders: CatalogOrderGroup[] = [];
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    const parsed = parseCatalogOrderNotes(o.notes);
    if (parsed.length === 0) continue;
    const bySupplier = new Map<string, typeof parsed>();
    for (const l of parsed) bySupplier.set(l.supplierName, [...(bySupplier.get(l.supplierName) ?? []), l]);
    for (const [supplierName, lines] of bySupplier) {
      const catalog = catalogRefs.find((c) => normalizeText(c.supplierName) === normalizeText(supplierName));
      const catItems = catalog ? catalogItems.get(catalog.id) ?? [] : [];
      catalogOrders.push({
        id: o.id,
        supplierName,
        date: o.created_at.slice(0, 10),
        deliveryDate: null,
        ddtNumbers: ddtByOrder.get(o.id) ?? [],
        lines: lines.map((l) => {
          const item = bestCatalogItem(l.name, catItems);
          return {
            ref: `catalog:${o.id}:${l.index}`,
            orderId: o.id,
            productId: null,
            priceKey: catalog ? priceKeyForCatalog(catalog.id, item?.name ?? l.name) : `n:${normalizeText(l.name)}`,
            name: l.name,
            sku: null,
            unit: item?.unit ?? "pz",
            quantity: l.quantity,
            receivedQty: receivedByOrderName.get(`${o.id}|${normalizeText(l.name)}`) ?? null,
            unitPrice: l.unitPrice,
            vatRate: null,
          };
        }),
      });
    }
  }

  // --- Listino of linked platform suppliers -------------------------
  const supplierIds = [...new Set([...suppliers.map((s) => s.supplierId), ...links.map((l) => l.supplier_id).filter((x): x is string => !!x)])];
  const supplierProducts = new Map<string, PriceListEntry[]>();
  for (const part of chunks(supplierIds, 50)) {
    for (const p of await rows<ProductRow>(
      admin
        .from("products")
        .select("id, supplier_id, name, sku, unit, price, packaging_size, packaging_unit, tax_rate")
        .in("supplier_id", part)
        .limit(5000),
      "products listino",
    )) {
      const list = supplierProducts.get(p.supplier_id!) ?? [];
      list.push({
        priceKey: priceKeyForProduct(p.id),
        productId: p.id,
        name: p.name,
        sku: p.sku,
        unit: p.unit,
        packHint: { packagingSize: p.packaging_size, packagingUnit: p.packaging_unit },
        price: Number(p.price ?? 0),
        source: "listino",
      });
      supplierProducts.set(p.supplier_id!, list);
    }
  }

  // --- Previously imported invoices ---------------------------------
  const existing = (
    await rows<{ id: string; supplier_vat: string | null; document_type: string; document_number: string; document_date: string | null; total_amount: number }>(
      admin
        .from("supplier_invoices")
        .select("id, supplier_vat, document_type, document_number, document_date, total_amount")
        .eq("restaurant_id", restaurantId)
        .limit(20000),
      "supplier_invoices existing",
    )
  ).map((e) => ({
    id: e.id,
    supplierVat: e.supplier_vat,
    documentType: e.document_type,
    number: e.document_number,
    date: e.document_date,
    gross: Number(e.total_amount),
  }));

  const alreadyInvoiced = new Set(
    (
      await rows<{ order_line_ref: string }>(
        admin.from("supplier_invoice_lines").select("order_line_ref").eq("restaurant_id", restaurantId).not("order_line_ref", "is", null).limit(50000),
        "invoiced refs",
      )
    ).map((r) => r.order_line_ref),
  );

  return {
    restaurantId,
    suppliers,
    catalogs: catalogRefs,
    links: new Map(links.map((l) => [l.supplier_vat, { supplierId: l.supplier_id, catalogId: l.catalog_id, source: l.source }])),
    supplierOrders,
    catalogOrders,
    catalogItems,
    supplierProducts,
    existing,
    alreadyInvoiced,
    receivingAvailable,
  };
}

function bestCatalogItem(name: string, items: Array<{ name: string; unit: string; price: number }>) {
  let best: { name: string; unit: string; price: number } | null = null;
  let score = 0;
  const n = normalizeText(name);
  for (const it of items) {
    if (normalizeText(it.name) === n) return it;
    const s = productSimilarity(name, it.name);
    if (s > score) {
      score = s;
      best = it;
    }
  }
  return score >= 0.8 ? best : null;
}

/* ------------------------------------------------------------------ */
/* Supplier resolution                                                  */
/* ------------------------------------------------------------------ */

export interface SupplierResolution {
  supplierId: string | null;
  relationshipId: string | null;
  catalogId: string | null;
  known: boolean;
  /** New automatic P.IVA link to persist. */
  autoLink: { vat: string; supplierId: string | null; catalogId: string | null } | null;
}

export function resolveSupplier(vatRaw: string | null, name: string | null, ref: ReferenceData): SupplierResolution {
  const vat = normalizeVat(vatRaw);
  const link = vat ? ref.links.get(vat) : undefined;
  if (link && (link.supplierId || link.catalogId)) {
    const rel = ref.suppliers.find((s) => s.supplierId === link.supplierId);
    return { supplierId: link.supplierId, relationshipId: rel?.relationshipId ?? null, catalogId: link.catalogId, known: true, autoLink: null };
  }
  const byVat = vat ? ref.suppliers.find((s) => s.vats.includes(vat)) : undefined;
  let supplier = byVat ?? null;
  if (!supplier && name) {
    let best: ConnectedSupplier | null = null;
    let bestScore = 0;
    for (const s of ref.suppliers) {
      const sc = companySimilarity(name, s.name);
      if (sc > bestScore) {
        bestScore = sc;
        best = s;
      }
    }
    if (best && bestScore >= 0.85) supplier = best;
  }
  let catalog: CatalogRef | null = null;
  if (supplier) catalog = ref.catalogs.find((c) => c.supplierId === supplier!.supplierId) ?? null;
  if (!catalog && name) {
    let bestScore = 0;
    for (const c of ref.catalogs) {
      const sc = companySimilarity(name, c.supplierName);
      if (sc > bestScore) {
        bestScore = sc;
        catalog = sc >= 0.85 ? c : catalog;
      }
    }
  }
  const known = !!supplier || !!catalog;
  return {
    supplierId: supplier?.supplierId ?? catalog?.supplierId ?? null,
    relationshipId: supplier?.relationshipId ?? catalog?.relationshipId ?? null,
    catalogId: catalog?.id ?? null,
    known,
    autoLink: known && vat ? { vat, supplierId: supplier?.supplierId ?? catalog?.supplierId ?? null, catalogId: catalog?.id ?? null } : null,
  };
}

/** Candidate orders + price list for one resolved supplier. */
export function candidatesFor(res: SupplierResolution, ref: ReferenceData): { orders: CandidateOrder[]; priceList: PriceListEntry[] } {
  const orders: CandidateOrder[] = [];
  if (res.supplierId) orders.push(...ref.supplierOrders.filter((o) => o.supplierId === res.supplierId));
  const catalog = res.catalogId ? ref.catalogs.find((c) => c.id === res.catalogId) : null;
  if (catalog) {
    orders.push(...ref.catalogOrders.filter((o) => normalizeText(o.supplierName) === normalizeText(catalog.supplierName)));
  }
  const priceList: PriceListEntry[] = [];
  if (catalog) {
    for (const it of ref.catalogItems.get(catalog.id) ?? []) {
      priceList.push({ priceKey: priceKeyForCatalog(catalog.id, it.name), productId: null, name: it.name, sku: null, unit: it.unit, price: it.price, source: "catalog" });
    }
  }
  if (res.supplierId) priceList.push(...(ref.supplierProducts.get(res.supplierId) ?? []));
  return { orders, priceList };
}
