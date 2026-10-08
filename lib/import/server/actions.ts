/* eslint-disable @typescript-eslint/no-explicit-any */
// `as any` on Supabase calls for tables missing from the generated types
// (restaurant_catalogs[_items], product_sales_units columns, import_memory).
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createCatalog } from "@/lib/catalogs/actions";
import { normalizeName, normalizeUnit } from "@/lib/catalogs/normalize";
import { requirePermission } from "@/lib/supplier/context";
import { SUPPLIER_PLATFORM_ENABLED } from "@/lib/utils/constants";
import { diffPriceLists } from "../match/diff.ts";
import { learnFromCorrections, supplierMemoryKeys, type Correction } from "../memory.ts";
import { IMPORT_LIMITS } from "../api-types.ts";
import { loadHints, resolveImportActor, saveHints } from "./context.ts";
import { ALL_SALE_UNITS } from "../parse/units.ts";
import { IMPORT_CATEGORIES } from "../lexicon/categories.ts";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const SaleUnitZ = z.enum(ALL_SALE_UNITS as [string, ...string[]]);
const CategoryZ = z.enum(IMPORT_CATEGORIES as [string, ...string[]]);
const ROLE = z.enum(["name", "code", "unit", "pack", "price", "vat", "brand", "category", "origin", "minQty", "availability", "qty", "ignore"]);

const CorrectionZ = z.object({
  sourceKey: z.string().max(400),
  original: z.string().max(1000),
  before: z.object({ name: z.string().max(200), priceUnit: SaleUnitZ, category: CategoryZ }),
  after: z.object({ name: z.string().max(200), priceUnit: SaleUnitZ, category: CategoryZ }),
  removed: z.boolean().optional(),
});

const LearningZ = z.object({
  corrections: z.array(CorrectionZ).max(IMPORT_LIMITS.maxItemsPerCommit).default([]),
  layouts: z.array(z.object({ signature: z.string().max(2000), roles: z.record(z.string(), ROLE) })).max(40).default([]),
});

// ---------------------------------------------------------------------------
// Restaurant: create / update a supplier price list (restaurant_catalogs)
// ---------------------------------------------------------------------------

const RestaurantCommitZ = z.object({
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("new") }),
    z.object({ kind: z.literal("existing"), catalogId: z.string().uuid(), removeMissing: z.boolean() }),
  ]),
  supplier: z.object({
    name: z.string().trim().min(1, "Nome fornitore obbligatorio").max(120),
    vatNumber: z.string().regex(/^\d{11}$/).nullish(),
    leadTimeDays: z.number().int().min(0).max(365).nullish(),
    minOrder: z.number().min(0).max(1_000_000).nullish(),
    notes: z.string().max(500).nullish(),
    deliveryDays: z.array(z.number().int().min(1).max(7)).max(7).default([]),
    emails: z.array(z.string().max(200)).max(5).default([]),
    phones: z.array(z.string().max(40)).max(5).default([]),
    address: z.string().max(200).nullish(),
  }),
  items: z
    .array(
      z.object({
        product_name: z.string().trim().min(1).max(200),
        unit: z.string().trim().min(1).max(20),
        price: z.number().min(0).max(1_000_000),
        notes: z.string().max(200).nullish(),
      }),
    )
    .min(1, "Nessun prodotto da importare")
    .max(IMPORT_LIMITS.maxItemsPerCommit),
  linkSupplierId: z.string().uuid().nullish(),
  learning: LearningZ.default({ corrections: [], layouts: [] }),
});

export type RestaurantCommitInput = z.input<typeof RestaurantCommitZ>;
export type RestaurantCommitOutput = {
  catalogId: string;
  inserted: number;
  updated: number;
  unchanged: number;
  removed: number;
  learned: number;
};

export async function commitRestaurantImport(input: RestaurantCommitInput): Promise<Result<RestaurantCommitOutput>> {
  const parsed = RestaurantCommitZ.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  const data = parsed.data;

  const auth = await resolveImportActor("restaurant");
  if (!auth.ok) return { ok: false, error: auth.error };
  const actor = auth.actor;
  if (actor.kind !== "restaurant") return { ok: false, error: "Ristorante non trovato" };

  const supabase = await createClient();
  const catalogFields = {
    supplier_name: data.supplier.name,
    delivery_days: data.supplier.leadTimeDays ?? null,
    min_order_amount: data.supplier.minOrder ?? null,
    notes: data.supplier.notes ?? null,
  };

  let catalogId: string;
  let restaurantId: string | null = actor.restaurantId;
  const existingItems: Array<{ id: string; name: string; unit: string; price: number }> = [];

  if (data.target.kind === "existing") {
    const { data: cat } = await (supabase as any)
      .from("restaurant_catalogs")
      .select("id, restaurant_id")
      .eq("id", data.target.catalogId)
      .in("restaurant_id", actor.scopeIds.length ? actor.scopeIds : ["00000000-0000-0000-0000-000000000000"])
      .maybeSingle();
    if (!cat) return { ok: false, error: "Catalogo non trovato" };
    catalogId = cat.id;
    restaurantId = cat.restaurant_id;
    const { error: upErr } = await (supabase as any).from("restaurant_catalogs").update(catalogFields).eq("id", catalogId);
    if (upErr) return { ok: false, error: upErr.message };
    const { data: items } = await (supabase as any)
      .from("restaurant_catalog_items")
      .select("id, product_name, unit, price")
      .eq("catalog_id", catalogId);
    for (const it of (items ?? []) as any[]) {
      existingItems.push({ id: it.id, name: it.product_name, unit: it.unit, price: Number(it.price) });
    }
  } else {
    // createCatalog checks partnership.manage and provisions the restaurant
    // row for owners who skipped onboarding.
    const created = await createCatalog({
      supplier_name: catalogFields.supplier_name,
      delivery_days: catalogFields.delivery_days,
      min_order_amount: catalogFields.min_order_amount,
      notes: catalogFields.notes,
    });
    if (!created.ok) return { ok: false, error: created.error };
    catalogId = created.data.id;
    restaurantId = created.data.restaurant_id;
  }

  if (data.linkSupplierId && SUPPLIER_PLATFORM_ENABLED) {
    await (supabase as any).from("restaurant_catalogs").update({ supplier_id: data.linkSupplierId }).eq("id", catalogId);
  }

  // ---- items: diff against what is there -----------------------------------
  const incoming = data.items.map((it, i) => ({ key: String(i), name: it.product_name, unit: it.unit, price: it.price }));
  const diff = diffPriceLists(existingItems, incoming);
  const byKey = new Map(incoming.map((i, idx) => [i.key, data.items[idx]!]));

  const inserts: any[] = [];
  const updates: Array<{ id: string; price: number; notes: string | null }> = [];
  const removals: string[] = [];
  let unchanged = 0;
  for (const e of diff.entries) {
    if (e.kind === "new" && e.incoming) {
      const it = byKey.get(e.incoming.key)!;
      inserts.push({
        catalog_id: catalogId,
        product_name: it.product_name,
        product_name_normalized: normalizeName(it.product_name),
        unit: normalizeUnit(it.unit),
        price: it.price,
        notes: it.notes ?? null,
      });
    } else if ((e.kind === "increased" || e.kind === "decreased") && e.incoming && e.existing) {
      const it = byKey.get(e.incoming.key)!;
      updates.push({ id: e.existing.id, price: it.price, notes: it.notes ?? null });
    } else if (e.kind === "unchanged") {
      unchanged++;
    } else if (e.kind === "removed" && e.existing && data.target.kind === "existing" && data.target.removeMissing) {
      removals.push(e.existing.id);
    }
  }

  for (let i = 0; i < inserts.length; i += 500) {
    const { error } = await (supabase as any).from("restaurant_catalog_items").insert(inserts.slice(i, i + 500));
    if (error) return { ok: false, error: `Errore salvataggio prodotti: ${error.message}` };
  }
  for (let i = 0; i < updates.length; i += 20) {
    const chunk = updates.slice(i, i + 20);
    const res = await Promise.all(
      chunk.map((u) =>
        (supabase as any).from("restaurant_catalog_items").update({ price: u.price, notes: u.notes }).eq("id", u.id).eq("catalog_id", catalogId),
      ),
    );
    const failed = res.find((r: any) => r.error);
    if (failed) return { ok: false, error: `Errore aggiornamento prezzi: ${failed.error.message}` };
  }
  if (removals.length) {
    for (let i = 0; i < removals.length; i += 200) {
      const { error } = await (supabase as any)
        .from("restaurant_catalog_items")
        .delete()
        .in("id", removals.slice(i, i + 200))
        .eq("catalog_id", catalogId);
      if (error) return { ok: false, error: `Errore rimozione prodotti: ${error.message}` };
    }
  }

  // ---- memory -----------------------------------------------------------------
  const keys = supplierMemoryKeys({ vatNumber: data.supplier.vatNumber, name: data.supplier.name }, catalogId);
  const previous = await loadHints({ ...actor, restaurantId }, [...keys].reverse());
  const { hints, learnedCount } = learnFromCorrections(previous, data.learning.corrections as Correction[], {
    layouts: data.learning.layouts as never,
    supplier: {
      name: data.supplier.name,
      vatNumber: data.supplier.vatNumber ?? null,
      emails: data.supplier.emails,
      phones: data.supplier.phones,
      address: data.supplier.address ?? null,
      deliveryDays: data.supplier.deliveryDays,
      minOrder: data.supplier.minOrder ?? null,
      leadTimeDays: data.supplier.leadTimeDays ?? null,
    },
  });
  await saveHints({ ...actor, restaurantId }, keys, hints, restaurantId);

  revalidatePath("/cataloghi");
  revalidatePath(`/cataloghi/${catalogId}`);
  revalidatePath("/cataloghi/confronta");
  revalidatePath("/fornitori");

  return {
    ok: true,
    data: { catalogId, inserted: inserts.length, updated: updates.length, unchanged, removed: removals.length, learned: learnedCount },
  };
}

// ---------------------------------------------------------------------------
// Supplier: update / create catalog products, optionally a named price list
// ---------------------------------------------------------------------------

const PRODUCT_UNITS = ["kg", "g", "lt", "ml", "pz", "cartone", "bottiglia", "latta", "confezione"] as const;
const SALES_UNIT_TYPES = ["piece", "kg", "g", "l", "ml", "box", "pallet", "bundle", "other"] as const;
const MACROS = ["carne", "pesce", "verdura", "frutta", "latticini", "secco", "bevande", "surgelati", "panetteria", "altro"] as const;

const SupplierCommitZ = z.object({
  creates: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        unit: z.enum(PRODUCT_UNITS),
        price: z.number().positive().max(1_000_000),
        category_id: z.string().uuid(),
        macro_category: z.enum(MACROS),
        brand: z.string().trim().max(120).nullish(),
        sku: z.string().trim().max(80).nullish(),
        tax_rate: z.number().min(0).max(100).nullish(),
        min_quantity: z.number().positive().max(100000).nullish(),
        packaging_size: z.number().positive().max(100000).nullish(),
        packaging_unit: z.string().trim().max(60).nullish(),
        origin: z.string().trim().max(200).nullish(),
        is_available: z.boolean().default(true),
        sales_unit: z.object({ label: z.string().trim().min(1).max(60), unit_type: z.enum(SALES_UNIT_TYPES) }),
      }),
    )
    .max(IMPORT_LIMITS.maxItemsPerCommit),
  updates: z
    .array(
      z.object({
        productId: z.string().uuid(),
        price: z.number().positive().max(1_000_000).nullish(),
        is_available: z.boolean().nullish(),
      }),
    )
    .max(IMPORT_LIMITS.maxItemsPerCommit),
  /** Products missing from the new list → marked unavailable (never deleted). */
  deactivateIds: z.array(z.string().uuid()).max(IMPORT_LIMITS.maxItemsPerCommit).default([]),
  priceList: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("none") }),
    z.object({ kind: z.literal("new"), name: z.string().trim().min(1).max(120) }),
    z.object({ kind: z.literal("existing"), id: z.string().uuid() }),
  ]),
  learning: LearningZ.default({ corrections: [], layouts: [] }),
});

export type SupplierCommitInput = z.input<typeof SupplierCommitZ>;
export type SupplierCommitOutput = {
  created: number;
  updated: number;
  deactivated: number;
  priceListId: string | null;
  priceListItems: number;
  learned: number;
  warnings: string[];
};

export async function commitSupplierImport(input: SupplierCommitInput): Promise<Result<SupplierCommitOutput>> {
  const parsed = SupplierCommitZ.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  const data = parsed.data;
  if (data.creates.length + data.updates.length + data.deactivateIds.length === 0) {
    return { ok: false, error: "Nessuna modifica da applicare" };
  }

  const auth = await resolveImportActor("supplier");
  if (!auth.ok) return { ok: false, error: auth.error };
  const actor = auth.actor;
  if (actor.kind !== "supplier") return { ok: false, error: "Profilo fornitore non trovato" };
  const supplierId = actor.supplierId;

  try {
    await requirePermission(supplierId, "catalog.edit");
  } catch {
    return { ok: false, error: "Il tuo ruolo non consente di modificare il catalogo." };
  }
  const warnings: string[] = [];
  const supabase = await createClient();

  // ---- ownership of updated products ------------------------------------------
  const touchIds = [...new Set([...data.updates.map((u) => u.productId), ...data.deactivateIds])];
  if (touchIds.length) {
    const owned = new Set<string>();
    for (let i = 0; i < touchIds.length; i += 500) {
      const { data: rows } = await supabase.from("products").select("id").eq("supplier_id", supplierId).in("id", touchIds.slice(i, i + 500)).returns<Array<{ id: string }>>();
      for (const r of rows ?? []) owned.add(r.id);
    }
    if (owned.size !== touchIds.length) return { ok: false, error: "Alcuni prodotti non appartengono al tuo catalogo." };
  }

  // ---- updates ---------------------------------------------------------------------
  let updated = 0;
  for (let i = 0; i < data.updates.length; i += 20) {
    const chunk = data.updates.slice(i, i + 20);
    const res = await Promise.all(
      chunk.map((u) => {
        const patch: Record<string, unknown> = {};
        if (u.price != null) patch.price = u.price;
        if (u.is_available != null) patch.is_available = u.is_available;
        if (Object.keys(patch).length === 0) return Promise.resolve({ error: null });
        return (supabase as any).from("products").update(patch).eq("id", u.productId).eq("supplier_id", supplierId);
      }),
    );
    const failed = res.find((r: any) => r.error);
    if (failed) return { ok: false, error: `Errore aggiornamento: ${(failed as any).error.message}` };
    updated += chunk.length;
  }

  let deactivated = 0;
  for (let i = 0; i < data.deactivateIds.length; i += 200) {
    const ids = data.deactivateIds.slice(i, i + 200);
    const { error } = await (supabase as any).from("products").update({ is_available: false }).in("id", ids).eq("supplier_id", supplierId);
    if (error) return { ok: false, error: `Errore disponibilità: ${error.message}` };
    deactivated += ids.length;
  }

  // ---- creates (+ base sales unit) ------------------------------------------------
  const createdIds: Array<{ id: string; price: number; idx: number }> = [];
  for (let i = 0; i < data.creates.length; i += 300) {
    const slice = data.creates.slice(i, i + 300);
    const rows = slice.map((c) => ({
      supplier_id: supplierId,
      category_id: c.category_id,
      macro_category: c.macro_category,
      name: c.name,
      brand: c.brand ?? null,
      sku: c.sku ?? null,
      unit: c.unit,
      price: c.price,
      // VAT from the document; otherwise the column default applies
      ...(c.tax_rate != null ? { tax_rate: c.tax_rate } : {}),
      min_quantity: c.min_quantity ?? 1,
      packaging_size: c.packaging_size ?? null,
      packaging_unit: c.packaging_unit ?? null,
      origin: c.origin ?? null,
      is_available: c.is_available,
    }));
    const { data: ins, error } = await (supabase as any).from("products").insert(rows, { defaultToNull: false }).select("id");
    if (error) return { ok: false, error: `Errore creazione prodotti: ${error.message}` };
    ((ins ?? []) as Array<{ id: string }>).forEach((r, k) => createdIds.push({ id: r.id, price: slice[k]!.price, idx: i + k }));
  }
  if (createdIds.length) {
    const unitRows = createdIds.map((c) => ({
      product_id: c.id,
      label: data.creates[c.idx]!.sales_unit.label,
      unit_type: data.creates[c.idx]!.sales_unit.unit_type,
      conversion_to_base: 1,
      is_base: true,
      moq: data.creates[c.idx]!.min_quantity ?? 1,
    }));
    for (let i = 0; i < unitRows.length; i += 500) {
      const { error } = await (supabase as any).from("product_sales_units").insert(unitRows.slice(i, i + 500));
      if (error) {
        warnings.push("Unità di vendita non create per alcuni prodotti: completale dalla scheda prodotto.");
        break;
      }
    }
    try {
      await (supabase.rpc as unknown as (fn: "refresh_catalog_summary") => Promise<unknown>)("refresh_catalog_summary");
    } catch {
      /* stale summary for a few seconds is fine */
    }
  }

  // ---- price lists -------------------------------------------------------------------
  const priced = [
    ...data.updates.filter((u) => u.price != null).map((u) => ({ id: u.productId, price: u.price! })),
    ...createdIds.map((c) => ({ id: c.id, price: c.price })),
  ];
  let priceListId: string | null = null;
  let priceListItems = 0;
  if (priced.length) {
    let canPrice = true;
    try {
      await requirePermission(supplierId, "pricing.edit");
    } catch {
      canPrice = false;
      if (data.priceList.kind !== "none") warnings.push("Il tuo ruolo non consente di modificare i listini: aggiornati solo i prezzi base.");
    }
    if (canPrice) {
      const { data: lists } = await supabase.from("price_lists").select("id, is_default").eq("supplier_id", supplierId).returns<Array<{ id: string; is_default: boolean }>>();
      const defaultId = lists?.find((l) => l.is_default)?.id ?? null;
      if (data.priceList.kind === "new") {
        const { data: pl, error } = await (supabase as any)
          .from("price_lists")
          .insert({ supplier_id: supplierId, name: data.priceList.name, is_default: false, is_active: true })
          .select("id")
          .single();
        if (error || !pl) warnings.push(`Listino non creato: ${error?.message ?? "errore"}`);
        else priceListId = pl.id;
      } else if (data.priceList.kind === "existing") {
        priceListId = lists?.some((l) => l.id === (data.priceList as { id: string }).id) ? (data.priceList as { id: string }).id : null;
        if (!priceListId) warnings.push("Listino selezionato non trovato.");
      }
      const targets = [...new Set([defaultId, priceListId].filter((x): x is string => !!x))];
      if (targets.length) {
        const baseUnits = new Map<string, string>();
        const ids = priced.map((p) => p.id);
        for (let i = 0; i < ids.length; i += 500) {
          const { data: su } = await (supabase as any)
            .from("product_sales_units")
            .select("id, product_id")
            .eq("is_base", true)
            .in("product_id", ids.slice(i, i + 500));
          for (const r of (su ?? []) as Array<{ id: string; product_id: string }>) baseUnits.set(r.product_id, r.id);
        }
        const rows = targets.flatMap((listId) =>
          priced
            .filter((p) => baseUnits.has(p.id))
            .map((p) => ({ price_list_id: listId, product_id: p.id, sales_unit_id: baseUnits.get(p.id)!, price: p.price })),
        );
        for (let i = 0; i < rows.length; i += 500) {
          const { error } = await (supabase as any)
            .from("price_list_items")
            .upsert(rows.slice(i, i + 500), { onConflict: "price_list_id,product_id,sales_unit_id" });
          if (error) {
            warnings.push(`Listino aggiornato solo in parte: ${error.message}`);
            break;
          }
          priceListItems += Math.min(500, rows.length - i);
        }
        const missing = priced.length - priced.filter((p) => baseUnits.has(p.id)).length;
        if (missing > 0) warnings.push(`${missing} prodotti senza unità di vendita base: prezzo aggiornato solo sul catalogo.`);
      }
    }
  }

  // ---- memory -------------------------------------------------------------------------
  const previous = await loadHints(actor, ["self"]);
  const { hints, learnedCount } = learnFromCorrections(previous, data.learning.corrections as Correction[], { layouts: data.learning.layouts as never });
  await saveHints(actor, ["self"], hints);

  revalidatePath("/supplier/catalogo");
  revalidatePath("/supplier/listini");

  return {
    ok: true,
    data: { created: createdIds.length, updated, deactivated, priceListId, priceListItems, learned: learnedCount, warnings },
  };
}
