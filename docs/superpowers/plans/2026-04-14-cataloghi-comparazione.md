# Cataloghi Fornitori & Comparazione Prezzi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** add a feature to the restaurant admin area (`app/(app)`) that lets a restaurant manually register supplier catalogs (imported from Excel/CSV) and compare them on price, delivery time, and minimum-order threshold.

**Architecture:** 2 new isolated Supabase tables (`restaurant_catalogs`, `restaurant_catalog_items`) with RLS scoped to the authenticated restaurant. React client components inside the existing dashboard shell. Parsing of Excel/CSV is done client-side (SheetJS + PapaParse). Pivot + composite score computed client-side over data fetched in one query.

**Tech Stack:** Next.js 15 (App Router) · Supabase SSR · TypeScript strict · Tailwind v4 (dark-dashboard tokens) · Zod v4 · PapaParse · SheetJS (`xlsx`) · lucide-react · sonner (toasts).

**Reference spec:** `docs/superpowers/specs/2026-04-14-cataloghi-comparazione-design.md`

**Testing model:** the project has no unit-test framework configured. Each task ends with **manual verification steps** the engineer runs in the browser (or via SQL console for migrations) before committing. No automated tests are added as part of this plan.

**Conventions (follow existing code):**
- Server actions in `lib/<domain>/actions.ts` with `"use server"` directive; return `{ ok: true; data } | { ok: false; error: string }`.
- Supabase browser client: `createClient()` from `@/lib/supabase/client`.
- Supabase server client: `createClient()` from `@/lib/supabase/server`.
- All UI strings in Italian.
- Use dark-dashboard tokens (`bg-surface-card`, `border-border-subtle`, `text-text-primary`, `accent-green`, etc.) already in `globals.css`.
- Reuse `DarkCard` from `components/dashboard/cards/` where available (inspect before writing new primitives).
- Toasts via `sonner`.
- Icons via `lucide-react` (verify the icon exists in `v1.6.0` before using — fallback to a near equivalent if not).

---

## File Structure

### Created
- `supabase/migrations/20260414000001_create_restaurant_catalogs.sql`
- `lib/catalogs/schemas.ts` — Zod schemas
- `lib/catalogs/types.ts` — derived TypeScript types + DB row types
- `lib/catalogs/normalize.ts` — `normalizeName`, `normalizePrice`, `normalizeUnit`
- `lib/catalogs/parse-file.ts` — `parseCsv`, `parseXlsx` (client-only)
- `lib/catalogs/compare.ts` — pivot + composite score computation
- `lib/catalogs/actions.ts` — server actions (CRUD catalog + items + batch import)
- `app/(app)/cataloghi/page.tsx` — list (server component)
- `app/(app)/cataloghi/catalogs-client.tsx` — list interactions
- `app/(app)/cataloghi/[id]/page.tsx` — detail (server component)
- `app/(app)/cataloghi/[id]/catalog-detail-client.tsx` — detail interactions
- `app/(app)/cataloghi/confronta/page.tsx` — compare (server component)
- `app/(app)/cataloghi/confronta/compare-client.tsx` — pivot
- `components/dashboard/restaurant/catalog-card.tsx`
- `components/dashboard/restaurant/catalog-form-dialog.tsx` — create/edit catalog
- `components/dashboard/restaurant/catalog-item-row.tsx`
- `components/dashboard/restaurant/catalog-item-dialog.tsx` — add/edit single item
- `components/dashboard/restaurant/catalog-import-wizard.tsx`
- `components/dashboard/restaurant/catalog-compare-table.tsx`
- `public/template-catalogo.csv`

### Modified
- `app/(app)/layout.tsx` — add `/cataloghi` to `NAV_ITEMS` and `MOBILE_NAV`
- `package.json` — add `papaparse`, `@types/papaparse`, `xlsx` deps

---

## Task 1 — Dependencies & scaffolding

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install parser dependencies**

Run (from repo root):

```bash
npm install papaparse xlsx
npm install -D @types/papaparse
```

- [ ] **Step 2: Verify install**

Run `npm ls papaparse xlsx @types/papaparse` and confirm all three resolve without `UNMET DEPENDENCY`.

- [ ] **Step 3: Ensure the app still builds**

Run `npm run build`. Expected: build completes without new errors (pre-existing warnings are fine).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add papaparse and xlsx for catalog import"
```

---

## Task 2 — Database migration

**Files:**
- Create: `supabase/migrations/20260414000001_create_restaurant_catalogs.sql`

- [ ] **Step 1: Write migration**

```sql
-- GastroBridge: restaurant personal supplier catalogs + items

CREATE TABLE restaurant_catalogs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id      uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  supplier_name      text NOT NULL CHECK (char_length(supplier_name) BETWEEN 1 AND 120),
  delivery_days      int  NULL CHECK (delivery_days IS NULL OR delivery_days >= 0),
  min_order_amount   numeric(10,2) NULL CHECK (min_order_amount IS NULL OR min_order_amount >= 0),
  notes              text NULL CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_restaurant_catalogs_restaurant_id ON restaurant_catalogs(restaurant_id);

CREATE TABLE restaurant_catalog_items (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id                uuid NOT NULL REFERENCES restaurant_catalogs(id) ON DELETE CASCADE,
  product_name              text NOT NULL CHECK (char_length(product_name) BETWEEN 1 AND 200),
  product_name_normalized   text NOT NULL,
  unit                      text NOT NULL CHECK (char_length(unit) BETWEEN 1 AND 20),
  price                     numeric(10,2) NOT NULL CHECK (price >= 0),
  notes                     text NULL CHECK (notes IS NULL OR char_length(notes) <= 200),
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_restaurant_catalog_items_catalog_id ON restaurant_catalog_items(catalog_id);
CREATE INDEX idx_restaurant_catalog_items_norm_unit ON restaurant_catalog_items(product_name_normalized, unit);

-- Trigger: keep updated_at current on restaurant_catalogs
CREATE OR REPLACE FUNCTION set_restaurant_catalogs_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_restaurant_catalogs_updated_at
  BEFORE UPDATE ON restaurant_catalogs
  FOR EACH ROW EXECUTE FUNCTION set_restaurant_catalogs_updated_at();

-- RLS
ALTER TABLE restaurant_catalogs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_catalog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant owner can manage own catalogs"
  ON restaurant_catalogs FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE profile_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE profile_id = auth.uid()));

CREATE POLICY "Restaurant owner can manage own catalog items"
  ON restaurant_catalog_items FOR ALL
  USING (
    catalog_id IN (
      SELECT rc.id FROM restaurant_catalogs rc
      JOIN restaurants r ON r.id = rc.restaurant_id
      WHERE r.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    catalog_id IN (
      SELECT rc.id FROM restaurant_catalogs rc
      JOIN restaurants r ON r.id = rc.restaurant_id
      WHERE r.profile_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Apply migration locally**

Run:

```bash
npx supabase db reset
```

(or `npx supabase db push` if you don't want to wipe local data — but `reset` re-runs every migration and is safer for a fresh state).

Expected output: all migrations applied, including the new one. No errors.

- [ ] **Step 3: Verify schema**

Run:

```bash
npx supabase db diff --schema public
```

Expected: empty diff — migrations match the database.

Also open Supabase Studio (local, usually `http://127.0.0.1:54323`) → Tables → confirm `restaurant_catalogs` and `restaurant_catalog_items` appear with the right columns.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260414000001_create_restaurant_catalogs.sql
git commit -m "feat(db): add restaurant_catalogs and items tables with RLS"
```

---

## Task 3 — Types & Zod schemas

**Files:**
- Create: `lib/catalogs/types.ts`
- Create: `lib/catalogs/schemas.ts`

- [ ] **Step 1: Write types**

`lib/catalogs/types.ts`:

```ts
export type CatalogRow = {
  id: string;
  restaurant_id: string;
  supplier_name: string;
  delivery_days: number | null;
  min_order_amount: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CatalogItemRow = {
  id: string;
  catalog_id: string;
  product_name: string;
  product_name_normalized: string;
  unit: string;
  price: number;
  notes: string | null;
  created_at: string;
};

export type CatalogWithItems = CatalogRow & {
  items: CatalogItemRow[];
};

export type ImportMode = "replace" | "append";

export type ImportRow = {
  product_name: string;
  unit: string;
  price: number;
  notes?: string | null;
};
```

- [ ] **Step 2: Write Zod schemas**

`lib/catalogs/schemas.ts`:

```ts
import { z } from "zod/v4";

export const CatalogSchema = z.object({
  supplier_name:    z.string().trim().min(1, "Nome fornitore obbligatorio").max(120),
  delivery_days:    z.number().int().nonnegative().max(365).nullish(),
  min_order_amount: z.number().nonnegative().max(1_000_000).nullish(),
  notes:            z.string().max(500).nullish(),
});

export const CatalogItemSchema = z.object({
  product_name: z.string().trim().min(1, "Nome prodotto obbligatorio").max(200),
  unit:         z.string().trim().min(1, "Unità obbligatoria").max(20),
  price:        z.number().nonnegative().max(1_000_000),
  notes:        z.string().max(200).nullish(),
});

export const ImportRowSchema = CatalogItemSchema;

export const CompareWeightsSchema = z
  .object({
    w_prezzo:   z.number().min(0).max(1),
    w_consegna: z.number().min(0).max(1),
  })
  .refine((w) => Math.abs(w.w_prezzo + w.w_consegna - 1) < 0.001, {
    message: "I pesi devono sommare a 1",
  });

export type CatalogInput     = z.infer<typeof CatalogSchema>;
export type CatalogItemInput = z.infer<typeof CatalogItemSchema>;
export type CompareWeights   = z.infer<typeof CompareWeightsSchema>;
```

- [ ] **Step 3: Typecheck**

Run `npx tsc --noEmit`. Expected: no new errors introduced by these files.

- [ ] **Step 4: Commit**

```bash
git add lib/catalogs/types.ts lib/catalogs/schemas.ts
git commit -m "feat(catalogs): add types and zod schemas"
```

---

## Task 4 — Normalization helpers

**Files:**
- Create: `lib/catalogs/normalize.ts`

- [ ] **Step 1: Write helpers**

```ts
/** Lowercase, trim, and collapse internal whitespace. */
export function normalizeName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Lowercase + trim. */
export function normalizeUnit(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Parse a price that may be in Italian format: "12,50", "€ 12,50", "12.50 €", "1.234,56".
 * Returns null if it cannot be parsed into a finite non-negative number.
 */
export function normalizePrice(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? Math.round(raw * 100) / 100 : null;
  if (typeof raw !== "string") return null;

  let s = raw.trim();
  if (s.length === 0) return null;

  s = s.replace(/€|eur|euro/gi, "").replace(/\s+/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // Italian: dots are thousands separators, comma is decimal.
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  // If only dots, trust them as decimal separator.

  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}
```

- [ ] **Step 2: Manual verification (node REPL)**

Run:

```bash
node -e "const m=require('./lib/catalogs/normalize.ts')"
```

(This will fail because TS — acceptable to skip. The real verification happens in Task 10 via the import wizard with sample inputs.)

Alternative: add a one-off scratch `.ts` file that logs outputs for these inputs, then delete it:

| Input | Expected `normalizePrice` |
|---|---|
| `"12,50"` | `12.5` |
| `"€ 12.50"` | `12.5` |
| `"1.234,56"` | `1234.56` |
| `"abc"` | `null` |
| `-5` | `null` |
| `0` | `0` |

Skip the automated check; we will validate via the import wizard (Task 11).

- [ ] **Step 3: Typecheck**

Run `npx tsc --noEmit`. Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/catalogs/normalize.ts
git commit -m "feat(catalogs): add name/unit/price normalization helpers"
```

---

## Task 5 — Server actions (catalog CRUD + items batch)

**Files:**
- Create: `lib/catalogs/actions.ts`

- [ ] **Step 1: Write actions**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CatalogSchema, CatalogItemSchema, type CatalogInput, type CatalogItemInput } from "./schemas";
import { normalizeName, normalizeUnit } from "./normalize";
import type { CatalogRow } from "./types";

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

async function getRestaurantId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("restaurants")
    .select("id")
    .eq("profile_id", user.id)
    .limit(1)
    .single<{ id: string }>();

  return data?.id ?? null;
}

export async function createCatalog(input: CatalogInput): Promise<Result<CatalogRow>> {
  const parsed = CatalogSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };

  const restaurantId = await getRestaurantId();
  if (!restaurantId) return { ok: false, error: "Ristorante non trovato" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurant_catalogs")
    .insert({
      restaurant_id:    restaurantId,
      supplier_name:    parsed.data.supplier_name,
      delivery_days:    parsed.data.delivery_days ?? null,
      min_order_amount: parsed.data.min_order_amount ?? null,
      notes:            parsed.data.notes ?? null,
    })
    .select("*")
    .single<CatalogRow>();

  if (error || !data) return { ok: false, error: error?.message ?? "Errore creazione catalogo" };
  revalidatePath("/cataloghi");
  return { ok: true, data };
}

export async function updateCatalog(id: string, input: CatalogInput): Promise<Result> {
  const parsed = CatalogSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("restaurant_catalogs")
    .update({
      supplier_name:    parsed.data.supplier_name,
      delivery_days:    parsed.data.delivery_days ?? null,
      min_order_amount: parsed.data.min_order_amount ?? null,
      notes:            parsed.data.notes ?? null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/cataloghi");
  revalidatePath(`/cataloghi/${id}`);
  return { ok: true, data: undefined };
}

export async function deleteCatalog(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("restaurant_catalogs").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/cataloghi");
  return { ok: true, data: undefined };
}

export async function createCatalogItem(catalogId: string, input: CatalogItemInput): Promise<Result> {
  const parsed = CatalogItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };

  const supabase = await createClient();
  const { error } = await supabase.from("restaurant_catalog_items").insert({
    catalog_id:               catalogId,
    product_name:             parsed.data.product_name,
    product_name_normalized:  normalizeName(parsed.data.product_name),
    unit:                     normalizeUnit(parsed.data.unit),
    price:                    parsed.data.price,
    notes:                    parsed.data.notes ?? null,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/cataloghi/${catalogId}`);
  return { ok: true, data: undefined };
}

export async function updateCatalogItem(id: string, catalogId: string, input: CatalogItemInput): Promise<Result> {
  const parsed = CatalogItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("restaurant_catalog_items")
    .update({
      product_name:            parsed.data.product_name,
      product_name_normalized: normalizeName(parsed.data.product_name),
      unit:                    normalizeUnit(parsed.data.unit),
      price:                   parsed.data.price,
      notes:                   parsed.data.notes ?? null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/cataloghi/${catalogId}`);
  return { ok: true, data: undefined };
}

export async function deleteCatalogItem(id: string, catalogId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("restaurant_catalog_items").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/cataloghi/${catalogId}`);
  return { ok: true, data: undefined };
}

/**
 * Batch import: validates all rows, then (if mode === 'replace') deletes current items,
 * then inserts the new ones in chunks of 500.
 */
export async function importCatalogItems(
  catalogId: string,
  rows: CatalogItemInput[],
  mode: "replace" | "append",
): Promise<Result<{ inserted: number }>> {
  if (rows.length === 0) return { ok: false, error: "Nessuna riga da importare" };
  if (rows.length > 5000) return { ok: false, error: "Massimo 5000 righe per import" };

  // Validate all rows before touching DB
  const prepared: {
    catalog_id: string;
    product_name: string;
    product_name_normalized: string;
    unit: string;
    price: number;
    notes: string | null;
  }[] = [];
  for (const row of rows) {
    const parsed = CatalogItemSchema.safeParse(row);
    if (!parsed.success) {
      return { ok: false, error: `Riga non valida: ${parsed.error.issues[0]?.message ?? "dati non validi"}` };
    }
    prepared.push({
      catalog_id:               catalogId,
      product_name:             parsed.data.product_name,
      product_name_normalized:  normalizeName(parsed.data.product_name),
      unit:                     normalizeUnit(parsed.data.unit),
      price:                    parsed.data.price,
      notes:                    parsed.data.notes ?? null,
    });
  }

  const supabase = await createClient();

  if (mode === "replace") {
    const { error: delErr } = await supabase
      .from("restaurant_catalog_items")
      .delete()
      .eq("catalog_id", catalogId);
    if (delErr) return { ok: false, error: delErr.message };
  }

  const CHUNK = 500;
  for (let i = 0; i < prepared.length; i += CHUNK) {
    const slice = prepared.slice(i, i + CHUNK);
    const { error } = await supabase.from("restaurant_catalog_items").insert(slice);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/cataloghi/${catalogId}`);
  revalidatePath("/cataloghi/confronta");
  return { ok: true, data: { inserted: prepared.length } };
}
```

- [ ] **Step 2: Typecheck**

Run `npx tsc --noEmit`. Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/catalogs/actions.ts
git commit -m "feat(catalogs): add server actions for catalogs and items"
```

---

## Task 6 — Sidebar + mobile nav entry

**Files:**
- Modify: `app/(app)/layout.tsx`

- [ ] **Step 1: Add nav entry**

Open `app/(app)/layout.tsx` and update `NAV_ITEMS` and `MOBILE_NAV`:

```tsx
const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",  label: "Dashboard",       iconName: "LayoutDashboard" },
  { href: "/cerca",      label: "Cerca Prodotti",  iconName: "Search" },
  { href: "/fornitori",  label: "Fornitori",       iconName: "Store" },
  { href: "/cataloghi",  label: "Cataloghi",       iconName: "BookMarked" },
  { href: "/ordini",     label: "Ordini",          iconName: "ClipboardList" },
  { href: "/carrello",   label: "Carrello",        iconName: "ShoppingCart" },
  { href: "/analytics",    label: "Analytics",     iconName: "BarChart3", section: "Gestione" },
  { href: "/impostazioni", label: "Impostazioni",  iconName: "Settings",  section: "Gestione" },
];

const MOBILE_NAV: MobileNavItem[] = [
  { href: "/dashboard",  label: "Home",     iconName: "LayoutDashboard" },
  { href: "/cerca",      label: "Cerca",    iconName: "Search" },
  { href: "/cataloghi",  label: "Catal.",   iconName: "BookMarked" },
  { href: "/ordini",     label: "Ordini",   iconName: "ClipboardList" },
  { href: "/impostazioni", label: "Altro",  iconName: "Settings" },
];
```

- [ ] **Step 2: Verify icon resolution**

Open `components/dashboard/sidebar/sidebar-item.tsx` (and `components/dashboard/icons.ts` if present) to confirm `BookMarked` is in the icon map — if not, add it by importing `BookMarked` from `lucide-react` into the existing icon registry the same way existing icons are registered. If `BookMarked` is unavailable in the installed lucide version, substitute with `Book` (verify with `node -e "console.log(Object.keys(require('lucide-react')).filter(k => k.toLowerCase().includes('book')))"`).

- [ ] **Step 3: Manual verification**

Run `npm run dev`, log in as a restaurant user, confirm the "Cataloghi" item appears in the sidebar (between "Fornitori" and "Ordini") and the icon renders. Clicking it will 404 for now — that's expected.

- [ ] **Step 4: Commit**

```bash
git add app/(app)/layout.tsx components/dashboard/icons.ts components/dashboard/sidebar/sidebar-item.tsx
git commit -m "feat(catalogs): add /cataloghi nav entry for restaurant"
```

---

## Task 7 — Catalog form dialog (create/edit)

**Files:**
- Create: `components/dashboard/restaurant/catalog-form-dialog.tsx`

- [ ] **Step 1: Write component**

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createCatalog, updateCatalog } from "@/lib/catalogs/actions";
import type { CatalogRow } from "@/lib/catalogs/types";

type Props = {
  open: boolean;
  onClose: () => void;
  catalog?: CatalogRow | null;
  onSaved?: (catalog?: CatalogRow) => void;
};

export function CatalogFormDialog({ open, onClose, catalog, onSaved }: Props) {
  const [supplierName, setSupplierName] = useState(catalog?.supplier_name ?? "");
  const [deliveryDays, setDeliveryDays] = useState<string>(catalog?.delivery_days?.toString() ?? "");
  const [minOrder, setMinOrder]         = useState<string>(catalog?.min_order_amount?.toString() ?? "");
  const [notes, setNotes]               = useState(catalog?.notes ?? "");
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  const parseOptionalNumber = (raw: string): number | null | undefined => {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed.replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : undefined; // undefined → invalid
  };

  const submit = () => {
    const dd = parseOptionalNumber(deliveryDays);
    const mo = parseOptionalNumber(minOrder);
    if (dd === undefined) { toast.error("Giorni di consegna non validi"); return; }
    if (mo === undefined) { toast.error("Importo minimo non valido"); return; }

    startTransition(async () => {
      const payload = {
        supplier_name:    supplierName.trim(),
        delivery_days:    dd === null ? null : Math.round(dd),
        min_order_amount: mo,
        notes:            notes.trim() || null,
      };
      const res = catalog
        ? await updateCatalog(catalog.id, payload)
        : await createCatalog(payload);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(catalog ? "Catalogo aggiornato" : "Catalogo creato");
      onSaved?.(catalog ? undefined : res.data);
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-surface-card border border-border-subtle p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-text-primary">
          {catalog ? "Modifica catalogo" : "Nuovo catalogo"}
        </h2>

        <div className="space-y-3">
          <label className="block">
            <span className="text-sm text-text-secondary">Nome fornitore *</span>
            <input
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
              placeholder="Es. Metro Italia"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm text-text-secondary">Consegna (gg)</span>
              <input
                type="number" inputMode="numeric" min={0}
                value={deliveryDays}
                onChange={(e) => setDeliveryDays(e.target.value)}
                className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
                placeholder="2"
              />
            </label>
            <label className="block">
              <span className="text-sm text-text-secondary">Min. ordine (€)</span>
              <input
                type="number" inputMode="decimal" min={0} step="0.01"
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
                placeholder="150"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm text-text-secondary">Note</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
              placeholder="Contatto, agente, orari..."
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-text-secondary hover:bg-surface-hover"
            disabled={pending}
          >
            Annulla
          </button>
          <button
            onClick={submit}
            disabled={pending || supplierName.trim().length === 0}
            className="px-4 py-2 rounded-lg bg-accent-green text-surface-base font-medium disabled:opacity-50"
          >
            {pending ? "Salvo..." : "Salva"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run `npx tsc --noEmit`. Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/restaurant/catalog-form-dialog.tsx
git commit -m "feat(catalogs): add create/edit dialog for catalog"
```

---

## Task 8 — Catalog list page `/cataloghi`

**Files:**
- Create: `components/dashboard/restaurant/catalog-card.tsx`
- Create: `app/(app)/cataloghi/page.tsx`
- Create: `app/(app)/cataloghi/catalogs-client.tsx`

- [ ] **Step 1: Write `catalog-card.tsx`**

```tsx
import Link from "next/link";
import { Truck, Euro, Package } from "lucide-react";

type Props = {
  id: string;
  supplierName: string;
  itemCount: number;
  deliveryDays: number | null;
  minOrder: number | null;
  updatedAt: string;
};

export function CatalogCard({ id, supplierName, itemCount, deliveryDays, minOrder, updatedAt }: Props) {
  return (
    <Link
      href={`/cataloghi/${id}`}
      className="block rounded-xl bg-surface-card border border-border-subtle p-5 hover:border-accent-green/40 transition-colors"
    >
      <div className="flex items-start justify-between">
        <h3 className="text-base font-semibold text-text-primary truncate">{supplierName}</h3>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
        <span className="inline-flex items-center gap-1"><Package className="h-3.5 w-3.5" /> {itemCount} prodotti</span>
        {deliveryDays !== null && (
          <span className="inline-flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> {deliveryDays} gg</span>
        )}
        {minOrder !== null && (
          <span className="inline-flex items-center gap-1"><Euro className="h-3.5 w-3.5" /> min {minOrder.toFixed(2)}</span>
        )}
      </div>
      <p className="mt-3 text-xs text-text-tertiary">
        Aggiornato {new Date(updatedAt).toLocaleDateString("it-IT")}
      </p>
    </Link>
  );
}
```

- [ ] **Step 2: Write `app/(app)/cataloghi/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import { CatalogsClient } from "./catalogs-client";
import type { CatalogRow } from "@/lib/catalogs/types";

type CatalogWithCount = CatalogRow & { item_count: number };

export default async function CatalogsPage() {
  const supabase = await createClient();

  const { data: catalogs } = await supabase
    .from("restaurant_catalogs")
    .select("*, items:restaurant_catalog_items(count)")
    .order("updated_at", { ascending: false });

  const flattened: CatalogWithCount[] = (catalogs ?? []).map((c: any) => ({
    id:               c.id,
    restaurant_id:    c.restaurant_id,
    supplier_name:    c.supplier_name,
    delivery_days:    c.delivery_days,
    min_order_amount: c.min_order_amount !== null ? Number(c.min_order_amount) : null,
    notes:            c.notes,
    created_at:       c.created_at,
    updated_at:       c.updated_at,
    item_count:       Array.isArray(c.items) ? (c.items[0]?.count ?? 0) : 0,
  }));

  return <CatalogsClient initialCatalogs={flattened} />;
}
```

- [ ] **Step 3: Write `catalogs-client.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, BarChart3 } from "lucide-react";
import { CatalogCard } from "@/components/dashboard/restaurant/catalog-card";
import { CatalogFormDialog } from "@/components/dashboard/restaurant/catalog-form-dialog";
import type { CatalogRow } from "@/lib/catalogs/types";

type Catalog = CatalogRow & { item_count: number };

export function CatalogsClient({ initialCatalogs }: { initialCatalogs: Catalog[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const canCompare = initialCatalogs.length >= 2;

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Cataloghi fornitori</h1>
          <p className="text-sm text-text-secondary">Inserisci i listini dei tuoi fornitori e confrontali.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/cataloghi/confronta"
            aria-disabled={!canCompare}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border-subtle text-text-primary ${
              canCompare ? "hover:bg-surface-hover" : "opacity-40 pointer-events-none"
            }`}
            title={canCompare ? "" : "Servono almeno 2 cataloghi"}
          >
            <BarChart3 className="h-4 w-4" /> Confronta tutti
          </Link>
          <button
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-green text-surface-base font-medium"
          >
            <Plus className="h-4 w-4" /> Nuovo catalogo
          </button>
        </div>
      </header>

      {initialCatalogs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-subtle p-12 text-center">
          <h2 className="text-lg font-medium text-text-primary">Nessun catalogo ancora</h2>
          <p className="mt-1 text-sm text-text-secondary">Crea il primo listino per iniziare a confrontare i prezzi.</p>
          <button
            onClick={() => setDialogOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-green text-surface-base font-medium"
          >
            <Plus className="h-4 w-4" /> Nuovo catalogo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {initialCatalogs.map((c) => (
            <CatalogCard
              key={c.id}
              id={c.id}
              supplierName={c.supplier_name}
              itemCount={c.item_count}
              deliveryDays={c.delivery_days}
              minOrder={c.min_order_amount}
              updatedAt={c.updated_at}
            />
          ))}
        </div>
      )}

      <CatalogFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={(c) => { if (c) router.push(`/cataloghi/${c.id}`); else router.refresh(); }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Manual verification**

Run `npm run dev`. Navigate to `/cataloghi`:
1. Expect empty state (no catalogs yet).
2. Click "Nuovo catalogo", fill "Test Fornitore A", consegna 2, min € 100, salva.
3. You should be redirected to `/cataloghi/<id>` (404 for now — expected; detail page comes in Task 9).
4. Back to `/cataloghi` → card appears with the data.
5. Create second catalog "Test Fornitore B" → "Confronta tutti" becomes clickable.

- [ ] **Step 5: Commit**

```bash
git add app/(app)/cataloghi/page.tsx app/(app)/cataloghi/catalogs-client.tsx components/dashboard/restaurant/catalog-card.tsx
git commit -m "feat(catalogs): add catalog list page"
```

---

## Task 9 — Catalog detail page `/cataloghi/[id]` (without import wizard yet)

**Files:**
- Create: `components/dashboard/restaurant/catalog-item-dialog.tsx`
- Create: `app/(app)/cataloghi/[id]/page.tsx`
- Create: `app/(app)/cataloghi/[id]/catalog-detail-client.tsx`

- [ ] **Step 1: Write `catalog-item-dialog.tsx`**

Mirror `catalog-form-dialog.tsx` pattern but for items. Fields: `product_name` (text), `unit` (text), `price` (number step 0.01), `notes` (text). Calls `createCatalogItem(catalogId, input)` or `updateCatalogItem(id, catalogId, input)` depending on whether an item prop is passed. Toast on result. Close on success. (Follow the exact component shape from Task 7 — inputs, buttons, dark tokens.)

Key interface:

```tsx
type Props = {
  open: boolean;
  onClose: () => void;
  catalogId: string;
  item?: { id: string; product_name: string; unit: string; price: number; notes: string | null } | null;
  onSaved?: () => void;
};
```

Implementation body (full):

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createCatalogItem, updateCatalogItem } from "@/lib/catalogs/actions";

type ItemData = { id: string; product_name: string; unit: string; price: number; notes: string | null };

type Props = {
  open: boolean;
  onClose: () => void;
  catalogId: string;
  item?: ItemData | null;
  onSaved?: () => void;
};

export function CatalogItemDialog({ open, onClose, catalogId, item, onSaved }: Props) {
  const [name, setName]     = useState(item?.product_name ?? "");
  const [unit, setUnit]     = useState(item?.unit ?? "");
  const [price, setPrice]   = useState<string>(item?.price?.toString() ?? "");
  const [notes, setNotes]   = useState(item?.notes ?? "");
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  const submit = () => {
    const p = Number(price.replace(",", "."));
    if (!Number.isFinite(p) || p < 0) { toast.error("Prezzo non valido"); return; }

    startTransition(async () => {
      const payload = {
        product_name: name.trim(),
        unit:         unit.trim(),
        price:        p,
        notes:        notes.trim() || null,
      };
      const res = item
        ? await updateCatalogItem(item.id, catalogId, payload)
        : await createCatalogItem(catalogId, payload);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(item ? "Prodotto aggiornato" : "Prodotto aggiunto");
      onSaved?.();
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-surface-card border border-border-subtle p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-text-primary">
          {item ? "Modifica prodotto" : "Nuovo prodotto"}
        </h2>
        <label className="block">
          <span className="text-sm text-text-secondary">Nome *</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm text-text-secondary">Unità *</span>
            <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)}
              className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
              placeholder="kg / L / pz" />
          </label>
          <label className="block">
            <span className="text-sm text-text-secondary">Prezzo (€) *</span>
            <input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)}
              className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary" />
          </label>
        </div>
        <label className="block">
          <span className="text-sm text-text-secondary">Note</span>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary" />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} disabled={pending}
            className="px-4 py-2 rounded-lg text-text-secondary hover:bg-surface-hover">Annulla</button>
          <button onClick={submit}
            disabled={pending || name.trim().length === 0 || unit.trim().length === 0 || price.trim().length === 0}
            className="px-4 py-2 rounded-lg bg-accent-green text-surface-base font-medium disabled:opacity-50">
            {pending ? "Salvo..." : "Salva"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `app/(app)/cataloghi/[id]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CatalogDetailClient } from "./catalog-detail-client";
import type { CatalogRow, CatalogItemRow } from "@/lib/catalogs/types";

export default async function CatalogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: catalog } = await supabase
    .from("restaurant_catalogs")
    .select("*")
    .eq("id", id)
    .single<CatalogRow>();

  if (!catalog) notFound();

  const { data: items } = await supabase
    .from("restaurant_catalog_items")
    .select("*")
    .eq("catalog_id", id)
    .order("product_name", { ascending: true });

  const rows: CatalogItemRow[] = (items ?? []).map((r: any) => ({
    ...r,
    price: Number(r.price),
  }));

  return (
    <CatalogDetailClient
      catalog={{ ...catalog, min_order_amount: catalog.min_order_amount !== null ? Number(catalog.min_order_amount) : null }}
      initialItems={rows}
    />
  );
}
```

- [ ] **Step 3: Write `catalog-detail-client.tsx`**

```tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2, Plus, Upload } from "lucide-react";
import { CatalogFormDialog } from "@/components/dashboard/restaurant/catalog-form-dialog";
import { CatalogItemDialog } from "@/components/dashboard/restaurant/catalog-item-dialog";
import { deleteCatalog, deleteCatalogItem } from "@/lib/catalogs/actions";
import type { CatalogRow, CatalogItemRow } from "@/lib/catalogs/types";

type ItemData = { id: string; product_name: string; unit: string; price: number; notes: string | null };

export function CatalogDetailClient({
  catalog,
  initialItems,
}: {
  catalog: CatalogRow;
  initialItems: CatalogItemRow[];
}) {
  const router = useRouter();
  const [editCatalog, setEditCatalog] = useState(false);
  const [itemDialog, setItemDialog] = useState<{ open: boolean; item: ItemData | null }>({ open: false, item: null });
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initialItems;
    return initialItems.filter((i) => i.product_name.toLowerCase().includes(q));
  }, [initialItems, query]);

  const avgPrice =
    initialItems.length === 0 ? 0 : initialItems.reduce((s, i) => s + i.price, 0) / initialItems.length;

  const onDelete = (itemId: string) => {
    if (!confirm("Eliminare questo prodotto?")) return;
    startTransition(async () => {
      const res = await deleteCatalogItem(itemId, catalog.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Prodotto eliminato");
      router.refresh();
    });
  };

  const onDeleteCatalog = () => {
    if (!confirm(`Eliminare il catalogo "${catalog.supplier_name}" e tutti i suoi prodotti?`)) return;
    startTransition(async () => {
      const res = await deleteCatalog(catalog.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Catalogo eliminato");
      router.push("/cataloghi");
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link href="/cataloghi" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
          <ArrowLeft className="h-4 w-4" /> Cataloghi
        </Link>
      </div>

      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{catalog.supplier_name}</h1>
          <div className="mt-1 text-sm text-text-secondary flex flex-wrap gap-x-4 gap-y-1">
            <span>{initialItems.length} prodotti</span>
            <span>Prezzo medio € {avgPrice.toFixed(2)}</span>
            {catalog.delivery_days !== null && <span>Consegna {catalog.delivery_days} gg</span>}
            {catalog.min_order_amount !== null && <span>Min. ordine € {catalog.min_order_amount.toFixed(2)}</span>}
          </div>
          {catalog.notes && <p className="mt-2 text-sm text-text-tertiary">{catalog.notes}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditCatalog(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-subtle text-text-primary hover:bg-surface-hover">
            <Pencil className="h-4 w-4" /> Modifica
          </button>
          {/* Import button — wired in Task 11 */}
          <button disabled
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-subtle text-text-tertiary opacity-50 cursor-not-allowed"
            title="Disponibile dopo Task 11">
            <Upload className="h-4 w-4" /> Importa da file
          </button>
          <button onClick={() => setItemDialog({ open: true, item: null })}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent-green text-surface-base font-medium">
            <Plus className="h-4 w-4" /> Aggiungi prodotto
          </button>
          <button onClick={onDeleteCatalog} disabled={pending}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-subtle text-red-400 hover:bg-red-500/10">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cerca prodotto..."
        className="w-full max-w-sm rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
      />

      <div className="rounded-xl border border-border-subtle overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-card text-text-tertiary">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Nome</th>
              <th className="text-left px-3 py-2 font-medium">Unità</th>
              <th className="text-right px-3 py-2 font-medium">Prezzo</th>
              <th className="text-left px-3 py-2 font-medium">Note</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-text-tertiary">Nessun prodotto</td></tr>
            ) : filtered.map((i) => (
              <tr key={i.id} className="border-t border-border-subtle hover:bg-surface-hover">
                <td className="px-3 py-2 text-text-primary">{i.product_name}</td>
                <td className="px-3 py-2 text-text-secondary">{i.unit}</td>
                <td className="px-3 py-2 text-right text-text-primary tabular-nums">€ {i.price.toFixed(2)}</td>
                <td className="px-3 py-2 text-text-tertiary">{i.notes}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => setItemDialog({ open: true, item: { id: i.id, product_name: i.product_name, unit: i.unit, price: i.price, notes: i.notes } })}
                    className="p-1.5 rounded hover:bg-surface-hover text-text-secondary" title="Modifica"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(i.id)}
                    className="p-1.5 rounded hover:bg-red-500/10 text-red-400" title="Elimina"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CatalogFormDialog
        open={editCatalog}
        onClose={() => setEditCatalog(false)}
        catalog={catalog}
        onSaved={() => router.refresh()}
      />
      <CatalogItemDialog
        open={itemDialog.open}
        onClose={() => setItemDialog({ open: false, item: null })}
        catalogId={catalog.id}
        item={itemDialog.item}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
```

- [ ] **Step 4: Manual verification**

Run `npm run dev`. Open the catalog created in Task 8. Add a product (e.g. "Farina 00", unit "kg", € 1.20). Edit it. Delete it. Edit catalog metadata from the "Modifica" button. Delete a catalog and confirm cascade (items disappear from DB and list is empty on return).

- [ ] **Step 5: Commit**

```bash
git add app/(app)/cataloghi/[id]/page.tsx app/(app)/cataloghi/[id]/catalog-detail-client.tsx components/dashboard/restaurant/catalog-item-dialog.tsx
git commit -m "feat(catalogs): add catalog detail page with item CRUD"
```

---

## Task 10 — File parser (CSV + XLSX) + template

**Files:**
- Create: `lib/catalogs/parse-file.ts`
- Create: `public/template-catalogo.csv`

- [ ] **Step 1: Write parser**

```ts
"use client";

import Papa from "papaparse";
import * as XLSX from "xlsx";

export type ParsedRow = Record<string, string>;
export type ParsedSheet = {
  headers: string[];      // from row 1 if hasHeader; else ["Col 1", "Col 2", ...]
  rows: ParsedRow[];      // keyed by header
  hasHeader: boolean;
};

export async function parseCsv(file: File, hasHeader = true): Promise<ParsedSheet> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (res) => {
        const rawRows = res.data as string[][];
        if (rawRows.length === 0) { reject(new Error("File vuoto")); return; }
        const headers = hasHeader
          ? rawRows[0]!.map((h, i) => (h?.trim() ? h.trim() : `Col ${i + 1}`))
          : rawRows[0]!.map((_, i) => `Col ${i + 1}`);
        const dataRows = hasHeader ? rawRows.slice(1) : rawRows;
        const rows: ParsedRow[] = dataRows.map((r) => {
          const obj: ParsedRow = {};
          headers.forEach((h, i) => { obj[h] = (r[i] ?? "").toString().trim(); });
          return obj;
        });
        resolve({ headers, rows, hasHeader });
      },
      error: (err) => reject(err),
    });
  });
}

export async function parseXlsx(file: File, hasHeader = true): Promise<ParsedSheet> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) throw new Error("Nessun foglio trovato");
  const sheet = wb.Sheets[firstSheetName]!;
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false }) as unknown[][];
  if (aoa.length === 0) throw new Error("Foglio vuoto");

  const firstRow = aoa[0]!.map((v) => (v == null ? "" : String(v)));
  const headers = hasHeader
    ? firstRow.map((h, i) => (h.trim() ? h.trim() : `Col ${i + 1}`))
    : firstRow.map((_, i) => `Col ${i + 1}`);
  const dataRows = hasHeader ? aoa.slice(1) : aoa;

  const rows: ParsedRow[] = dataRows.map((r) => {
    const obj: ParsedRow = {};
    headers.forEach((h, i) => { obj[h] = (r[i] == null ? "" : String(r[i])).trim(); });
    return obj;
  });
  return { headers, rows, hasHeader };
}

/** Suggest best header matches for each target field. */
export function suggestMapping(headers: string[]): { name?: string; unit?: string; price?: string } {
  const lc = (s: string) => s.toLowerCase();
  const nameCandidates  = ["nome", "descrizione", "articolo", "prodotto", "descr"];
  const unitCandidates  = ["unita", "unità", "um", "u.m.", "u.m", "confezione"];
  const priceCandidates = ["prezzo", "costo", "€", "eur", "importo"];

  const find = (cands: string[]) => headers.find((h) => cands.some((c) => lc(h).includes(c)));

  return { name: find(nameCandidates), unit: find(unitCandidates), price: find(priceCandidates) };
}
```

- [ ] **Step 2: Write template CSV**

`public/template-catalogo.csv` (LF line endings, UTF-8):

```
nome,unita,prezzo
Farina 00,kg,1.20
Olio EVO,L,8.50
```

- [ ] **Step 3: Typecheck**

Run `npx tsc --noEmit`. Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add lib/catalogs/parse-file.ts public/template-catalogo.csv
git commit -m "feat(catalogs): add CSV/XLSX parser and import template"
```

---

## Task 11 — Import wizard (3 steps) + wire in detail page

**Files:**
- Create: `components/dashboard/restaurant/catalog-import-wizard.tsx`
- Modify: `app/(app)/cataloghi/[id]/catalog-detail-client.tsx`

- [ ] **Step 1: Write wizard**

```tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { UploadCloud, FileSpreadsheet, Check, ArrowLeft, Download } from "lucide-react";
import { parseCsv, parseXlsx, suggestMapping, type ParsedSheet } from "@/lib/catalogs/parse-file";
import { normalizePrice } from "@/lib/catalogs/normalize";
import { importCatalogItems } from "@/lib/catalogs/actions";
import type { CatalogItemInput } from "@/lib/catalogs/schemas";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 5000;

type Mapping = { name: string; unit: string; price: string };
type Step = "upload" | "map" | "preview";
type ValidatedRow =
  | { ok: true; data: CatalogItemInput }
  | { ok: false; reason: string; raw: { name: string; unit: string; price: string } };

type Props = {
  open: boolean;
  onClose: () => void;
  catalogId: string;
  onImported?: () => void;
};

export function CatalogImportWizard({ open, onClose, catalogId, onImported }: Props) {
  const [step, setStep]       = useState<Step>("upload");
  const [hasHeader, setHasHeader] = useState(true);
  const [sheet, setSheet]     = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<Mapping>({ name: "", unit: "", price: "" });
  const [mode, setMode]       = useState<"replace" | "append">("append");
  const [pending, startTransition] = useTransition();

  const reset = () => { setStep("upload"); setSheet(null); setMapping({ name: "", unit: "", price: "" }); };
  const closeAll = () => { reset(); onClose(); };

  if (!open) return null;

  const handleFile = async (file: File) => {
    if (file.size > MAX_BYTES) { toast.error("File troppo grande (max 2MB)"); return; }
    try {
      const ext = file.name.toLowerCase().split(".").pop() ?? "";
      let parsed: ParsedSheet;
      if (ext === "csv") parsed = await parseCsv(file, hasHeader);
      else if (ext === "xlsx" || ext === "xls") parsed = await parseXlsx(file, hasHeader);
      else { toast.error("Formato non supportato"); return; }

      if (parsed.rows.length === 0) { toast.error("Nessuna riga di dati nel file"); return; }
      if (parsed.rows.length > MAX_ROWS) { toast.error(`Troppe righe (max ${MAX_ROWS})`); return; }

      setSheet(parsed);
      const suggested = suggestMapping(parsed.headers);
      setMapping({
        name:  suggested.name  ?? parsed.headers[0] ?? "",
        unit:  suggested.unit  ?? parsed.headers[1] ?? "",
        price: suggested.price ?? parsed.headers[2] ?? "",
      });
      setStep("map");
    } catch (e: any) {
      toast.error(e?.message ?? "Errore lettura file");
    }
  };

  const validated: ValidatedRow[] = useMemo(() => {
    if (!sheet) return [];
    return sheet.rows.map((r) => {
      const name = (r[mapping.name] ?? "").trim();
      const unit = (r[mapping.unit] ?? "").trim();
      const priceRaw = (r[mapping.price] ?? "").trim();

      if (!name)  return { ok: false, reason: "Nome vuoto",  raw: { name, unit, price: priceRaw } };
      if (!unit)  return { ok: false, reason: "Unità vuota", raw: { name, unit, price: priceRaw } };
      const price = normalizePrice(priceRaw);
      if (price === null) return { ok: false, reason: "Prezzo non valido", raw: { name, unit, price: priceRaw } };

      return { ok: true, data: { product_name: name, unit, price, notes: null } };
    });
  }, [sheet, mapping]);

  const validCount = validated.filter((v) => v.ok).length;
  const invalidCount = validated.length - validCount;

  const confirmImport = () => {
    const valid = validated.filter((v): v is Extract<ValidatedRow, { ok: true }> => v.ok).map((v) => v.data);
    if (valid.length === 0) { toast.error("Nessuna riga valida da importare"); return; }
    startTransition(async () => {
      const res = await importCatalogItems(catalogId, valid, mode);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`Importate ${res.data.inserted} righe`);
      onImported?.();
      closeAll();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeAll}>
      <div className="w-full max-w-3xl rounded-xl bg-surface-card border border-border-subtle p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Importa catalogo da file</h2>
          <div className="text-xs text-text-tertiary">
            {step === "upload" ? "1/3 Upload" : step === "map" ? "2/3 Mappa colonne" : "3/3 Anteprima"}
          </div>
        </header>

        {step === "upload" && (
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
              Il file ha un'intestazione sulla prima riga
            </label>
            <label className="block rounded-xl border-2 border-dashed border-border-subtle p-12 text-center cursor-pointer hover:border-accent-green/40">
              <UploadCloud className="mx-auto h-8 w-8 text-text-tertiary" />
              <p className="mt-3 text-text-primary">Clicca per scegliere un file</p>
              <p className="mt-1 text-xs text-text-tertiary">CSV, XLS, XLSX · max 2MB · max 5000 righe</p>
              <input type="file" accept=".csv,.xls,.xlsx" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </label>
            <a href="/template-catalogo.csv" download
              className="inline-flex items-center gap-1 text-sm text-accent-green hover:underline">
              <Download className="h-4 w-4" /> Scarica template CSV
            </a>
          </div>
        )}

        {step === "map" && sheet && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(["name", "unit", "price"] as const).map((field) => (
                <label key={field} className="block">
                  <span className="text-sm text-text-secondary capitalize">
                    {field === "name" ? "Nome prodotto" : field === "unit" ? "Unità" : "Prezzo"} *
                  </span>
                  <select
                    value={mapping[field]}
                    onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}
                    className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
                  >
                    <option value="">—</option>
                    {sheet.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div className="rounded-lg border border-border-subtle overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-base text-text-tertiary">
                  <tr>{sheet.headers.map((h) => <th key={h} className="text-left px-2 py-1 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {sheet.rows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-t border-border-subtle">
                      {sheet.headers.map((h) => <td key={h} className="px-2 py-1 text-text-secondary">{r[h]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep("upload")} className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary">
                <ArrowLeft className="h-4 w-4" /> Indietro
              </button>
              <button
                onClick={() => setStep("preview")}
                disabled={!mapping.name || !mapping.unit || !mapping.price}
                className="px-4 py-2 rounded-lg bg-accent-green text-surface-base font-medium disabled:opacity-50"
              >
                Continua
              </button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm">
              <span className="inline-flex items-center gap-1 text-accent-green"><Check className="h-4 w-4" /> {validCount} valide</span>
              <span className="text-red-400">{invalidCount} scartate</span>
            </div>

            <div className="rounded-lg border border-border-subtle max-h-64 overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-base text-text-tertiary sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1 font-medium">Stato</th>
                    <th className="text-left px-2 py-1 font-medium">Nome</th>
                    <th className="text-left px-2 py-1 font-medium">Unità</th>
                    <th className="text-right px-2 py-1 font-medium">Prezzo</th>
                    <th className="text-left px-2 py-1 font-medium">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {validated.map((v, i) => (
                    <tr key={i} className="border-t border-border-subtle">
                      {v.ok ? (
                        <>
                          <td className="px-2 py-1 text-accent-green">OK</td>
                          <td className="px-2 py-1 text-text-primary">{v.data.product_name}</td>
                          <td className="px-2 py-1 text-text-secondary">{v.data.unit}</td>
                          <td className="px-2 py-1 text-right text-text-primary tabular-nums">€ {v.data.price.toFixed(2)}</td>
                          <td className="px-2 py-1" />
                        </>
                      ) : (
                        <>
                          <td className="px-2 py-1 text-red-400">✗</td>
                          <td className="px-2 py-1 text-text-tertiary">{v.raw.name || "—"}</td>
                          <td className="px-2 py-1 text-text-tertiary">{v.raw.unit || "—"}</td>
                          <td className="px-2 py-1 text-right text-text-tertiary tabular-nums">{v.raw.price || "—"}</td>
                          <td className="px-2 py-1 text-red-400">{v.reason}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <fieldset className="flex gap-4 text-sm">
              <label className="inline-flex items-center gap-1">
                <input type="radio" checked={mode === "append"} onChange={() => setMode("append")} /> Aggiungi al catalogo
              </label>
              <label className="inline-flex items-center gap-1">
                <input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} /> Sostituisci catalogo
              </label>
            </fieldset>

            <div className="flex justify-between">
              <button onClick={() => setStep("map")} className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary">
                <ArrowLeft className="h-4 w-4" /> Indietro
              </button>
              <button
                onClick={confirmImport}
                disabled={pending || validCount === 0}
                className="px-4 py-2 rounded-lg bg-accent-green text-surface-base font-medium disabled:opacity-50"
              >
                {pending ? "Importo..." : `Conferma (${validCount} righe)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into `catalog-detail-client.tsx`**

In `app/(app)/cataloghi/[id]/catalog-detail-client.tsx`:
1. Add import: `import { CatalogImportWizard } from "@/components/dashboard/restaurant/catalog-import-wizard";`
2. Add state: `const [importOpen, setImportOpen] = useState(false);`
3. Replace the disabled "Importa da file" button with:

```tsx
<button onClick={() => setImportOpen(true)}
  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-subtle text-text-primary hover:bg-surface-hover">
  <Upload className="h-4 w-4" /> Importa da file
</button>
```

4. At the bottom of the component (next to the other dialogs), add:

```tsx
<CatalogImportWizard
  open={importOpen}
  onClose={() => setImportOpen(false)}
  catalogId={catalog.id}
  onImported={() => router.refresh()}
/>
```

- [ ] **Step 3: Manual verification**

Run `npm run dev`.
1. Open a catalog → click "Importa da file".
2. Upload `public/template-catalogo.csv` → auto-mapping fills `nome/unita/prezzo`. Continue.
3. Anteprima shows 2 OK, 0 scartate. Click "Conferma".
4. After refresh, 2 items appear in the catalog.
5. Test an Excel: create a quick `.xlsx` with columns `Descrizione | U.M. | Prezzo €` and 3 rows (one with price "12,50", one with "abc", one with empty name). After mapping: 1 valid, 2 scartate. Confirm.
6. Test "Sostituisci catalogo" with the template — verify previous items are cleared.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/restaurant/catalog-import-wizard.tsx app/(app)/cataloghi/[id]/catalog-detail-client.tsx
git commit -m "feat(catalogs): add 3-step import wizard for CSV/XLSX"
```

---

## Task 12 — Compare logic lib

**Files:**
- Create: `lib/catalogs/compare.ts`

- [ ] **Step 1: Write compare lib**

```ts
import type { CatalogRow, CatalogItemRow } from "./types";

export type SupplierCol = Pick<CatalogRow, "id" | "supplier_name" | "delivery_days" | "min_order_amount">;

export type PivotRow = {
  key: string;                                // `${product_name_normalized}::${unit}`
  productName: string;                        // display label (first encountered)
  unit: string;
  prices: Record<string, number | null>;      // supplierId -> price | null
  bestPriceSupplierId: string | null;
  bestCompositeSupplierId: string | null;
};

export type Pivot = {
  suppliers: SupplierCol[];
  rows: PivotRow[];
  /** Sum of all prices per supplier for products they offer. */
  totals: Record<string, number>;
  /** Sum of min price per row. */
  basketOptimalPrice: number;
  /** Sum of prices picked by composite winner per row. */
  basketOptimalComposite: number;
};

export function buildPivot(
  suppliers: SupplierCol[],
  items: (CatalogItemRow & { catalog_id: string })[],
  weights: { w_prezzo: number; w_consegna: number },
): Pivot {
  // Group items by (norm_name, unit)
  type Group = { productName: string; unit: string; bySupplier: Record<string, number> };
  const groups = new Map<string, Group>();
  for (const it of items) {
    const key = `${it.product_name_normalized}::${it.unit}`;
    let g = groups.get(key);
    if (!g) { g = { productName: it.product_name, unit: it.unit, bySupplier: {} }; groups.set(key, g); }
    // If same supplier has duplicate rows for the same (name, unit), keep the lowest price.
    const supplierId = supplierFor(suppliers, it.catalog_id);
    if (!supplierId) continue;
    const prev = g.bySupplier[supplierId];
    if (prev === undefined || it.price < prev) g.bySupplier[supplierId] = it.price;
  }

  const rows: PivotRow[] = [];
  for (const [key, g] of groups) {
    const prices: Record<string, number | null> = {};
    for (const s of suppliers) prices[s.id] = g.bySupplier[s.id] ?? null;

    // Best price
    const priceEntries = Object.entries(prices).filter(([, p]) => p !== null) as [string, number][];
    const bestPriceSupplierId =
      priceEntries.length === 0 ? null : priceEntries.reduce((a, b) => (a[1] <= b[1] ? a : b))[0];

    // Best composite (requires delivery_days present on the supplier's catalog)
    const compositeCandidates = priceEntries.filter(([sid]) =>
      suppliers.find((s) => s.id === sid)?.delivery_days !== null,
    );
    let bestCompositeSupplierId: string | null = null;
    if (compositeCandidates.length > 0) {
      const pArr = compositeCandidates.map(([, p]) => p);
      const minP = Math.min(...pArr), maxP = Math.max(...pArr);
      const daysArr = compositeCandidates.map(([sid]) => suppliers.find((s) => s.id === sid)!.delivery_days!);
      const minD = Math.min(...daysArr), maxD = Math.max(...daysArr);

      const scored = compositeCandidates.map(([sid, price]) => {
        const d = suppliers.find((s) => s.id === sid)!.delivery_days!;
        const normP = maxP === minP ? 0 : (price - minP) / (maxP - minP);
        const normD = maxD === minD ? 0 : (d - minD) / (maxD - minD);
        const score = weights.w_prezzo * normP + weights.w_consegna * normD;
        return { sid, score };
      });
      bestCompositeSupplierId = scored.reduce((a, b) => (a.score <= b.score ? a : b)).sid;
    }

    rows.push({ key, productName: g.productName, unit: g.unit, prices, bestPriceSupplierId, bestCompositeSupplierId });
  }

  // Totals per supplier
  const totals: Record<string, number> = {};
  for (const s of suppliers) totals[s.id] = 0;
  for (const r of rows) {
    for (const [sid, p] of Object.entries(r.prices)) if (p !== null) totals[sid]! += p;
  }

  // Optimal baskets
  let basketOptimalPrice = 0, basketOptimalComposite = 0;
  for (const r of rows) {
    if (r.bestPriceSupplierId) basketOptimalPrice += r.prices[r.bestPriceSupplierId]!;
    if (r.bestCompositeSupplierId) basketOptimalComposite += r.prices[r.bestCompositeSupplierId]!;
  }

  rows.sort((a, b) => a.productName.localeCompare(b.productName, "it"));
  return { suppliers, rows, totals, basketOptimalPrice, basketOptimalComposite };
}

function supplierFor(suppliers: SupplierCol[], catalogId: string): string | null {
  // In this model, catalog_id IS the supplier column id.
  return suppliers.find((s) => s.id === catalogId)?.id ?? null;
}
```

- [ ] **Step 2: Typecheck**

Run `npx tsc --noEmit`. Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/catalogs/compare.ts
git commit -m "feat(catalogs): add pivot + composite score computation"
```

---

## Task 13 — Compare page `/cataloghi/confronta`

**Files:**
- Create: `components/dashboard/restaurant/catalog-compare-table.tsx`
- Create: `app/(app)/cataloghi/confronta/page.tsx`
- Create: `app/(app)/cataloghi/confronta/compare-client.tsx`

- [ ] **Step 1: Write `compare-client.tsx`** (handles interactivity: weight sliders, filters, export)

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Star } from "lucide-react";
import { buildPivot, type SupplierCol } from "@/lib/catalogs/compare";
import type { CatalogItemRow } from "@/lib/catalogs/types";

type Props = {
  suppliers: SupplierCol[];
  items: (CatalogItemRow & { catalog_id: string })[];
};

export function CompareClient({ suppliers, items }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(suppliers.map((s) => s.id)));
  const [wPrezzo, setWPrezzo] = useState(0.7);
  const [query, setQuery] = useState("");
  const [onlyMulti, setOnlyMulti] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("gb.compare.weights");
    if (raw) {
      const v = Number(raw);
      if (Number.isFinite(v) && v >= 0 && v <= 1) setWPrezzo(v);
    }
  }, []);
  useEffect(() => { localStorage.setItem("gb.compare.weights", String(wPrezzo)); }, [wPrezzo]);

  const filteredSuppliers = useMemo(
    () => suppliers.filter((s) => selected.has(s.id)),
    [suppliers, selected],
  );
  const filteredItems = useMemo(
    () => items.filter((i) => selected.has(i.catalog_id)),
    [items, selected],
  );

  const pivot = useMemo(
    () => buildPivot(filteredSuppliers, filteredItems, { w_prezzo: wPrezzo, w_consegna: 1 - wPrezzo }),
    [filteredSuppliers, filteredItems, wPrezzo],
  );

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pivot.rows.filter((r) => {
      if (q && !r.productName.toLowerCase().includes(q)) return false;
      if (onlyMulti) {
        const offered = Object.values(r.prices).filter((p) => p !== null).length;
        if (offered < 2) return false;
      }
      return true;
    });
  }, [pivot.rows, query, onlyMulti]);

  const mostExpensiveTotal = Math.max(0, ...Object.values(pivot.totals));
  const saving = mostExpensiveTotal - pivot.basketOptimalPrice;
  const savingPct = mostExpensiveTotal > 0 ? (saving / mostExpensiveTotal) * 100 : 0;

  const exportCsv = () => {
    const head = ["Prodotto", "Unità", ...filteredSuppliers.map((s) => s.supplier_name), "Miglior prezzo", "Miglior composito"];
    const lines = [head.join(";")];
    for (const r of visibleRows) {
      const cells = [
        quote(r.productName),
        quote(r.unit),
        ...filteredSuppliers.map((s) => r.prices[s.id] == null ? "" : r.prices[s.id]!.toFixed(2)),
        supplierName(filteredSuppliers, r.bestPriceSupplierId),
        supplierName(filteredSuppliers, r.bestCompositeSupplierId),
      ];
      lines.push(cells.join(";"));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `confronto-cataloghi-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link href="/cataloghi" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
          <ArrowLeft className="h-4 w-4" /> Cataloghi
        </Link>
      </div>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-text-primary">Confronto prezzi</h1>
        <p className="text-sm text-text-secondary">
          Il miglior prezzo per riga è evidenziato in verde. Il miglior complessivo (prezzo + consegna) con una stella.
        </p>
      </header>

      {/* Supplier toggle */}
      <div className="flex flex-wrap gap-2">
        {suppliers.map((s) => (
          <label key={s.id} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm ${
            selected.has(s.id) ? "border-accent-green/50 bg-accent-green/10 text-accent-green" : "border-border-subtle text-text-secondary"
          }`}>
            <input type="checkbox" className="sr-only" checked={selected.has(s.id)}
              onChange={() =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                  return next;
                })} />
            {s.supplier_name}
          </label>
        ))}
      </div>

      {/* Weights */}
      <div className="rounded-xl bg-surface-card border border-border-subtle p-4 space-y-2 max-w-xl">
        <div className="flex justify-between text-sm text-text-secondary">
          <span>Peso prezzo: {(wPrezzo * 100).toFixed(0)}%</span>
          <span>Peso consegna: {((1 - wPrezzo) * 100).toFixed(0)}%</span>
        </div>
        <input type="range" min={0} max={1} step={0.05} value={wPrezzo}
          onChange={(e) => setWPrezzo(Number(e.target.value))}
          className="w-full" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input type="search" placeholder="Cerca prodotto..." value={query} onChange={(e) => setQuery(e.target.value)}
          className="rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary w-64" />
        <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
          <input type="checkbox" checked={onlyMulti} onChange={(e) => setOnlyMulti(e.target.checked)} />
          Solo prodotti offerti da ≥ 2 fornitori
        </label>
        <button onClick={exportCsv}
          className="ml-auto inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-border-subtle text-text-primary hover:bg-surface-hover">
          <Download className="h-4 w-4" /> Esporta CSV
        </button>
      </div>

      {/* Pivot table */}
      <div className="rounded-xl border border-border-subtle overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-card text-text-tertiary">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Prodotto</th>
              <th className="text-left px-3 py-2 font-medium">Unità</th>
              {filteredSuppliers.map((s) => (
                <th key={s.id} className="text-right px-3 py-2 font-medium">
                  <div className="text-text-primary">{s.supplier_name}</div>
                  <div className="text-[10px] text-text-tertiary">
                    {s.delivery_days !== null ? `🚚 ${s.delivery_days} gg` : "— gg"}
                    {s.min_order_amount !== null ? ` · min € ${s.min_order_amount.toFixed(2)}` : ""}
                  </div>
                </th>
              ))}
              <th className="text-left px-3 py-2 font-medium">Miglior prezzo</th>
              <th className="text-left px-3 py-2 font-medium">Miglior composito</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr><td colSpan={filteredSuppliers.length + 4} className="px-3 py-6 text-center text-text-tertiary">Nessun prodotto da confrontare</td></tr>
            ) : visibleRows.map((r) => (
              <tr key={r.key} className="border-t border-border-subtle">
                <td className="px-3 py-2 text-text-primary">{r.productName}</td>
                <td className="px-3 py-2 text-text-secondary">{r.unit}</td>
                {filteredSuppliers.map((s) => {
                  const p = r.prices[s.id];
                  const isBestPrice = r.bestPriceSupplierId === s.id;
                  const isBestComposite = r.bestCompositeSupplierId === s.id;
                  return (
                    <td key={s.id} className={`px-3 py-2 text-right tabular-nums ${
                      isBestPrice ? "bg-accent-green/10 text-accent-green font-medium" : "text-text-primary"
                    }`}>
                      {p == null ? "—" : <>€ {p.toFixed(2)} {isBestComposite && <Star className="inline h-3 w-3 ml-0.5" />}</>}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-accent-green">{supplierName(filteredSuppliers, r.bestPriceSupplierId)}</td>
                <td className="px-3 py-2 text-text-primary">{supplierName(filteredSuppliers, r.bestCompositeSupplierId)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-surface-card">
            <tr className="border-t border-border-subtle">
              <td colSpan={2} className="px-3 py-2 font-medium text-text-primary">Totale per fornitore</td>
              {filteredSuppliers.map((s) => {
                const total = pivot.totals[s.id] ?? 0;
                const belowMin = s.min_order_amount !== null && total > 0 && total < s.min_order_amount;
                return (
                  <td key={s.id} className="px-3 py-2 text-right tabular-nums">
                    <div className="text-text-primary">€ {total.toFixed(2)}</div>
                    {belowMin && (
                      <div className="text-[10px] text-red-400">Sotto soglia (−€ {(s.min_order_amount! - total).toFixed(2)})</div>
                    )}
                  </td>
                );
              })}
              <td colSpan={2} />
            </tr>
            <tr className="border-t border-border-subtle">
              <td colSpan={2} className="px-3 py-2 font-medium text-text-primary">Basket ottimale (prezzo)</td>
              <td colSpan={filteredSuppliers.length} className="px-3 py-2 text-right tabular-nums text-accent-green font-medium">
                € {pivot.basketOptimalPrice.toFixed(2)}
              </td>
              <td colSpan={2} />
            </tr>
            <tr>
              <td colSpan={2} className="px-3 py-2 font-medium text-text-primary">Basket ottimale (composito)</td>
              <td colSpan={filteredSuppliers.length} className="px-3 py-2 text-right tabular-nums text-text-primary">
                € {pivot.basketOptimalComposite.toFixed(2)}
              </td>
              <td colSpan={2} />
            </tr>
            {saving > 0 && (
              <tr>
                <td colSpan={2 + filteredSuppliers.length + 2} className="px-3 py-2">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent-green/10 text-accent-green text-sm">
                    Risparmio potenziale: € {saving.toFixed(2)} ({savingPct.toFixed(0)}%)
                  </span>
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function supplierName(suppliers: SupplierCol[], id: string | null): string {
  if (!id) return "—";
  return suppliers.find((s) => s.id === id)?.supplier_name ?? "—";
}

function quote(s: string): string {
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
```

- [ ] **Step 2: Write `page.tsx`**

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CompareClient } from "./compare-client";
import type { SupplierCol } from "@/lib/catalogs/compare";
import type { CatalogItemRow } from "@/lib/catalogs/types";

export default async function CatalogComparePage() {
  const supabase = await createClient();

  const { data: catalogs } = await supabase
    .from("restaurant_catalogs")
    .select("id, supplier_name, delivery_days, min_order_amount")
    .order("supplier_name", { ascending: true });

  const suppliers: SupplierCol[] = (catalogs ?? []).map((c: any) => ({
    id:               c.id,
    supplier_name:    c.supplier_name,
    delivery_days:    c.delivery_days,
    min_order_amount: c.min_order_amount !== null ? Number(c.min_order_amount) : null,
  }));

  if (suppliers.length < 2) {
    return (
      <div className="p-6 space-y-3">
        <h1 className="text-2xl font-semibold text-text-primary">Confronto prezzi</h1>
        <p className="text-text-secondary">Servono almeno 2 cataloghi per confrontare.</p>
        <Link href="/cataloghi" className="text-accent-green hover:underline">← Torna ai cataloghi</Link>
      </div>
    );
  }

  const ids = suppliers.map((s) => s.id);
  const { data: items } = await supabase
    .from("restaurant_catalog_items")
    .select("*")
    .in("catalog_id", ids as any);

  const rows: (CatalogItemRow & { catalog_id: string })[] = (items ?? []).map((r: any) => ({
    ...r,
    price: Number(r.price),
  }));

  return <CompareClient suppliers={suppliers} items={rows} />;
}
```

- [ ] **Step 3: Manual verification**

Run `npm run dev`. With ≥ 2 catalogs containing overlapping products, navigate to `/cataloghi/confronta` (or click "Confronta tutti").

Scenario A — Set up two catalogs:
- Fornitore A: consegna 2 gg, min € 100 → "Farina 00, kg, 1.20", "Olio EVO, L, 8.50"
- Fornitore B: consegna 5 gg, min € 50  → "Farina 00, kg, 1.10", "Olio EVO, L, 9.00", "Pomodoro pelato, kg, 2.00"

Verify:
1. Pivot shows 3 rows. "Farina 00" row → A=1.20, B=1.10 (B highlighted green). Composite default 70/30 → still B (cheaper and slower is overridden by price weight).
2. Move weight slider to 0% prezzo / 100% consegna → composite for "Farina 00" becomes A (faster).
3. "Olio EVO" → A cheaper, green. "Pomodoro pelato" → only B offers it, no highlight.
4. Footer: Totale A = € 9.70, Totale B = € 12.10. Basket ottimale (prezzo) = 1.10 + 8.50 + 2.00 = € 11.60.
5. Since Totale A (9.70) < min ordine A (100) → chip rosso "Sotto soglia".
6. Toggle "Solo prodotti offerti da ≥ 2 fornitori" → "Pomodoro pelato" scompare.
7. Export CSV → scarica file con separator `;` e le righe visibili.
8. Deseleziona Fornitore A → pivot mostra solo B.

- [ ] **Step 4: Commit**

```bash
git add app/(app)/cataloghi/confronta/page.tsx app/(app)/cataloghi/confronta/compare-client.tsx
git commit -m "feat(catalogs): add pivot comparison page with weights + export"
```

---

## Task 14 — Mobile fallback for pivot

**Files:**
- Modify: `app/(app)/cataloghi/confronta/compare-client.tsx`

- [ ] **Step 1: Add mobile card view**

In the pivot section of `CompareClient`, wrap the existing table in `<div className="hidden md:block">...</div>` and add below it a `<div className="md:hidden space-y-3">...</div>` that renders each `visibleRows` entry as a card:

```tsx
<div className="md:hidden space-y-3">
  {visibleRows.length === 0 ? (
    <p className="text-center text-text-tertiary py-6">Nessun prodotto</p>
  ) : visibleRows.map((r) => {
    const offers = filteredSuppliers
      .map((s) => ({ s, price: r.prices[s.id] }))
      .filter((x): x is { s: SupplierCol; price: number } => x.price !== null)
      .sort((a, b) => a.price - b.price);
    return (
      <div key={r.key} className="rounded-xl bg-surface-card border border-border-subtle p-3">
        <div className="flex justify-between items-baseline">
          <h3 className="text-text-primary font-medium">{r.productName}</h3>
          <span className="text-xs text-text-tertiary">{r.unit}</span>
        </div>
        <ul className="mt-2 space-y-1 text-sm">
          {offers.map(({ s, price }) => {
            const isBestPrice = r.bestPriceSupplierId === s.id;
            const isBestComposite = r.bestCompositeSupplierId === s.id;
            return (
              <li key={s.id} className="flex justify-between">
                <span className={isBestPrice ? "text-accent-green" : "text-text-secondary"}>
                  {s.supplier_name} {isBestComposite && <Star className="inline h-3 w-3 ml-0.5" />}
                </span>
                <span className={`tabular-nums ${isBestPrice ? "text-accent-green font-medium" : "text-text-primary"}`}>
                  € {price.toFixed(2)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  })}
</div>
```

Keep the other sections (weights, filters, footer totals) visible on mobile as-is — they wrap naturally.

- [ ] **Step 2: Manual verification**

Resize browser to < 768px (or use DevTools device mode). Pivot table is hidden; card list renders with best-price supplier in green and star next to best composite. Supplier toggle and weight slider remain usable.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/cataloghi/confronta/compare-client.tsx
git commit -m "feat(catalogs): add mobile card view for compare pivot"
```

---

## Task 15 — End-to-end smoke test

**Files:** none (verification only)

- [ ] **Step 1: Full user journey**

From scratch in a clean DB (`npx supabase db reset`), as a restaurant user:

1. Log in → sidebar shows "Cataloghi" between "Fornitori" and "Ordini".
2. `/cataloghi` → empty state → create "Metro" (consegna 2, min 150).
3. In "Metro", add 3 items manually.
4. Import a CSV with 10 more items via wizard → "Aggiungi" → 13 total.
5. Create second catalog "Dolciaria X" (consegna 4, min 80); import an XLSX with prices overlapping partially.
6. `/cataloghi/confronta` → pivot shows both, with highlights, totals, and min-order chip.
7. Move weight slider → composite column updates live.
8. Filter "solo ≥ 2 fornitori" → only overlap rows remain.
9. Export CSV → file opens in Excel with correct columns.
10. Log in as a different restaurant user → `/cataloghi` is empty (RLS isolation).

- [ ] **Step 2: Build check**

Run `npm run build`. Expected: build succeeds. Any new ESLint warnings under `app/(app)/cataloghi` or `lib/catalogs` or `components/dashboard/restaurant/catalog-*` should be addressed before closing.

- [ ] **Step 3: Final commit tag**

If all steps pass, no new commit needed. The feature is complete.

---

## Deviation notes (for executor)

- If `BookMarked` is not exported by the installed `lucide-react`, fall back to `Book` or `BookOpen` and annotate the choice in the commit message for Task 6.
- If Supabase returns `numeric` fields as strings (depending on client version), the `Number(r.xxx)` casts already handle that — keep them.
- For very large catalogs (> 1000 rows), the pivot is still computed client-side. If this becomes slow during verification, wrap `buildPivot` in `useMemo` (already done) and consider a follow-up PR with server-side precomputation — out of scope here.
- The `lucide-react` version in `package.json` is `^1.6.0` which is **unusual** (the mainline package is currently at `0.x` / has been through multiple resets). Before Task 6, run `node -e "console.log(Object.keys(require('lucide-react')).slice(0,20))"` to confirm the actual export surface. If `BookMarked`, `UploadCloud`, `FileSpreadsheet`, `Truck`, `Euro`, `Package`, `Star`, `Pencil`, `Trash2`, `Download`, `ArrowLeft`, `Plus`, `Upload`, `Check`, `BarChart3`, or `Search` are missing, substitute with nearest equivalents and mention the substitutions in the relevant commit.
