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
import { applyLimit, importCommitLimiter } from "@/lib/utils/rate-limit";
import { normalizeWhatsAppPhone } from "@/lib/restaurants/channels/text";
import { diffPriceLists } from "../match/diff.ts";
import { isoToJsWeekdays } from "../catalog-mapping.ts";
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
    orderCutoff: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Orario limite non valido (HH:MM)").nullish(),
    emails: z.array(z.string().max(200)).max(5).default([]),
    phones: z.array(z.string().max(40)).max(5).default([]),
    address: z.string().max(200).nullish(),
  }),
  /** Save delivery days / cut-off into restaurant_supplier_schedules (ISO weekdays 1–7). */
  schedule: z
    .object({
      weekdays: z.array(z.number().int().min(1).max(7)).max(7),
      cutoffTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
      leadDays: z.number().int().min(0).max(14).nullable(),
    })
    .nullish(),
  /** Save the ordering contact into restaurant_catalog_contacts. */
  contact: z
    .object({
      preferredChannel: z.enum(["whatsapp", "email", "pdf", "phone"]),
      phone: z.string().trim().max(40).nullable(),
      email: z.string().trim().max(200).nullable(),
    })
    .nullish(),
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
  scheduleSaved: boolean;
  contactSaved: boolean;
  warnings: string[];
};

const MISSING_TABLE = /does not exist|schema cache|42P01/i;

function friendlyDbError(err: { message?: string; code?: string } | null | undefined): string {
  if (!err) return "errore sconosciuto";
  if (err.code === "42P01" || MISSING_TABLE.test(err.message ?? "")) return "funzione non ancora attiva (migrazioni da applicare)";
  if (err.code === "42501" || /row-level security/i.test(err.message ?? "")) return "il tuo ruolo non lo consente";
  return err.message ?? "errore";
}

/** Keep what is in the catalog notes and add the new parts ("P.IVA …", "Tel …") once. */
function mergeNotes(existing: string | null, incoming: string | null): string | null {
  const have = (existing ?? "").trim();
  const add = (incoming ?? "")
    .split(/\s+·\s+/)
    .map((x) => x.trim())
    .filter((x) => x && !have.toLowerCase().includes(x.toLowerCase()));
  const out = [have, ...add].filter(Boolean).join(" · ").slice(0, 500);
  return out || null;
}


export async function commitRestaurantImport(input: RestaurantCommitInput): Promise<Result<RestaurantCommitOutput>> {
  const parsed = RestaurantCommitZ.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  const data = parsed.data;

  const auth = await resolveImportActor("restaurant");
  if (!auth.ok) return { ok: false, error: auth.error };
  const actor = auth.actor;
  if (actor.kind !== "restaurant") return { ok: false, error: "Ristorante non trovato" };

  const limit = await applyLimit(importCommitLimiter, `import-commit:${actor.userId}`);
  if (!limit.allowed) return { ok: false, error: "Hai salvato molti listini di fila: riprova tra qualche minuto." };

  const supabase = await createClient();
  const warnings: string[] = [];
  // The P.IVA always lands in the notes: it is how the next import recognises this supplier.
  let notes = data.supplier.notes?.trim() || null;
  if (data.supplier.vatNumber && !(notes ?? "").includes(data.supplier.vatNumber)) {
    notes = `P.IVA ${data.supplier.vatNumber}${notes ? ` · ${notes}` : ""}`.slice(0, 500);
  }
  const catalogFields = {
    supplier_name: data.supplier.name,
    delivery_days: data.supplier.leadTimeDays ?? null,
    min_order_amount: data.supplier.minOrder ?? null,
    notes,
  };

  let catalogId: string;
  let restaurantId: string | null = actor.restaurantId;
  const existingItems: Array<{ id: string; name: string; unit: string; price: number }> = [];

  if (data.target.kind === "existing") {
    const { data: cat } = await (supabase as any)
      .from("restaurant_catalogs")
      .select("id, restaurant_id, notes")
      .eq("id", data.target.catalogId)
      .in("restaurant_id", actor.scopeIds.length ? actor.scopeIds : ["00000000-0000-0000-0000-000000000000"])
      .maybeSingle();
    if (!cat) return { ok: false, error: "Catalogo non trovato" };
    catalogId = cat.id;
    restaurantId = cat.restaurant_id;
    // Updating a list keeps the name and the notes the restaurant already has;
    // only conditions actually found in the new document overwrite old ones.
    const patch: Record<string, unknown> = { notes: mergeNotes(cat.notes ?? null, notes) };
    if (catalogFields.delivery_days != null) patch.delivery_days = catalogFields.delivery_days;
    if (catalogFields.min_order_amount != null) patch.min_order_amount = catalogFields.min_order_amount;
    const { error: upErr } = await (supabase as any).from("restaurant_catalogs").update(patch).eq("id", catalogId);
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

  // ---- delivery schedule + ordering contact (best effort, never blocks) -------
  let scheduleSaved = false;
  let contactSaved = false;
  if (restaurantId && data.schedule && (data.schedule.weekdays.length > 0 || data.schedule.cutoffTime)) {
    const r = await saveImportedSchedule(supabase, { restaurantId, catalogId, userId: actor.userId, ...data.schedule });
    if (r === true) scheduleSaved = true;
    else warnings.push(`Giorni di consegna non salvati: ${r}. Puoi impostarli da Consegne.`);
  }
  if (restaurantId && data.contact) {
    const r = await saveImportedContact(supabase, { restaurantId, catalogId, userId: actor.userId, ...data.contact });
    if (r === true) contactSaved = true;
    else if (r) warnings.push(`Contatto per gli ordini non salvato: ${r}.`);
  }

  revalidatePath("/cataloghi");
  revalidatePath(`/cataloghi/${catalogId}`);
  revalidatePath("/cataloghi/confronta");
  revalidatePath("/fornitori");
  if (scheduleSaved || contactSaved) {
    revalidatePath("/consegne");
    revalidatePath("/dashboard");
  }

  return {
    ok: true,
    data: {
      catalogId,
      inserted: inserts.length,
      updated: updates.length,
      unchanged,
      removed: removals.length,
      learned: learnedCount,
      scheduleSaved,
      contactSaved,
      warnings,
    },
  };
}

type Db = Awaited<ReturnType<typeof createClient>>;

/**
 * Delivery days / cut-off found in the document → restaurant_supplier_schedules
 * (one row per catalog). An existing schedule keeps its reminder settings and
 * notes; only the values found in the new document replace the old ones.
 * RLS (rss team write: order.submit) is the authoritative gate.
 */
async function saveImportedSchedule(
  db: Db,
  s: { restaurantId: string; catalogId: string; userId: string; weekdays: number[]; cutoffTime: string | null; leadDays: number | null },
): Promise<true | string> {
  const supabase = db as any;
  const weekdays = isoToJsWeekdays(s.weekdays);
  const { data: existing, error: selErr } = await supabase
    .from("restaurant_supplier_schedules")
    .select("id")
    .eq("restaurant_id", s.restaurantId)
    .eq("catalog_id", s.catalogId)
    .maybeSingle();
  if (selErr) return friendlyDbError(selErr);
  const patch: Record<string, unknown> = { updated_by: s.userId };
  if (weekdays.length) patch.delivery_weekdays = weekdays;
  if (s.cutoffTime) patch.cutoff_time = s.cutoffTime;
  if (s.leadDays != null) patch.lead_days = s.leadDays;
  const res = existing
    ? await supabase.from("restaurant_supplier_schedules").update(patch).eq("id", existing.id)
    : await supabase.from("restaurant_supplier_schedules").insert({
        restaurant_id: s.restaurantId,
        catalog_id: s.catalogId,
        supplier_id: null,
        delivery_weekdays: weekdays,
        cutoff_time: s.cutoffTime,
        lead_days: s.leadDays ?? 1,
        reminder_enabled: true,
        updated_by: s.userId,
      });
  return res.error ? friendlyDbError(res.error) : true;
}

/**
 * Supplier phone / e-mail → restaurant_catalog_contacts (how orders are sent
 * to an off-platform supplier). An existing contact is only completed (empty
 * fields), never overwritten: the restaurant may have chosen another channel.
 * Returns true, an error message, or null when there was nothing to save.
 */
async function saveImportedContact(
  db: Db,
  c: { restaurantId: string; catalogId: string; userId: string; preferredChannel: "whatsapp" | "email" | "pdf" | "phone"; phone: string | null; email: string | null },
): Promise<true | string | null> {
  const supabase = db as any;
  const phone = normalizeWhatsAppPhone(c.phone);
  const email = c.email && z.string().email().max(200).safeParse(c.email.toLowerCase()).success ? c.email.toLowerCase() : null;
  if (!phone && !email) return null;
  let channel = c.preferredChannel;
  if ((channel === "whatsapp" || channel === "phone") && !phone) channel = email ? "email" : "pdf";
  if (channel === "email" && !email) channel = phone ? "phone" : "pdf";

  const { data: existing, error: selErr } = await supabase
    .from("restaurant_catalog_contacts")
    .select("catalog_id, whatsapp_phone, email")
    .eq("catalog_id", c.catalogId)
    .maybeSingle();
  if (selErr) return friendlyDbError(selErr);
  if (existing) {
    const patch: Record<string, unknown> = {};
    if (!existing.whatsapp_phone && phone) patch.whatsapp_phone = phone;
    if (!existing.email && email) patch.email = email;
    if (Object.keys(patch).length === 0) return true;
    patch.updated_by = c.userId;
    const { error } = await supabase.from("restaurant_catalog_contacts").update(patch).eq("catalog_id", c.catalogId);
    return error ? friendlyDbError(error) : true;
  }
  const { error } = await supabase.from("restaurant_catalog_contacts").insert({
    catalog_id: c.catalogId,
    restaurant_id: c.restaurantId,
    preferred_channel: channel,
    whatsapp_phone: phone,
    email,
    updated_by: c.userId,
  });
  return error ? friendlyDbError(error) : true;
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
  /** Unchanged products: their price goes into the named price list only. */
  listPrices: z
    .array(z.object({ productId: z.string().uuid(), price: z.number().positive().max(1_000_000) }))
    .max(IMPORT_LIMITS.maxItemsPerCommit)
    .default([]),
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
  const namedList = data.priceList.kind !== "none";
  if (data.creates.length + data.updates.length + data.deactivateIds.length + (namedList ? data.listPrices.length : 0) === 0) {
    return { ok: false, error: "Nessuna modifica da applicare" };
  }

  const auth = await resolveImportActor("supplier");
  if (!auth.ok) return { ok: false, error: auth.error };
  const actor = auth.actor;
  if (actor.kind !== "supplier") return { ok: false, error: "Profilo fornitore non trovato" };
  const supplierId = actor.supplierId;

  const limit = await applyLimit(importCommitLimiter, `import-commit:${actor.userId}`);
  if (!limit.allowed) return { ok: false, error: "Hai applicato molti import di fila: riprova tra qualche minuto." };

  try {
    await requirePermission(supplierId, "catalog.edit");
  } catch {
    return { ok: false, error: "Il tuo ruolo non consente di modificare il catalogo." };
  }
  const warnings: string[] = [];
  const supabase = await createClient();

  // ---- ownership of updated products ------------------------------------------
  const touchIds = [...new Set([...data.updates.map((u) => u.productId), ...data.deactivateIds, ...data.listPrices.map((l) => l.productId)])];
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
  if (priced.length || (namedList && data.listPrices.length)) {
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
        const listOnly = priceListId ? data.listPrices.map((l) => ({ id: l.productId, price: l.price })) : [];
        const ids = [...priced, ...listOnly].map((p) => p.id);
        for (let i = 0; i < ids.length; i += 500) {
          const { data: su } = await (supabase as any)
            .from("product_sales_units")
            .select("id, product_id")
            .eq("is_base", true)
            .in("product_id", ids.slice(i, i + 500));
          for (const r of (su ?? []) as Array<{ id: string; product_id: string }>) baseUnits.set(r.product_id, r.id);
        }
        const rows = targets.flatMap((listId) =>
          [...priced, ...(listId === priceListId ? listOnly : [])]
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
        const missing = [...priced, ...listOnly].filter((p) => !baseUnits.has(p.id)).length;
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
