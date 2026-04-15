# Admin Fornitore — Fase 1A: Fondamenta & Catalogo pro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** porre le fondamenta schema + RLS + permessi dell'intera Fase 1 e consegnare la prima slice di UI professionale: catalogo prodotti con `sales_units` multiple, listini editabili (editor base), gestione staff (inviti/ruoli) e magazzini. Tutto dietro feature flag `suppliers.feature_flags.phase1_enabled`. Backward compat con `products.price` preservata.

**Architecture:**
- **Una sola migrazione Supabase** crea TUTTI gli enum e le nuove tabelle di §3 del design (anche quelle sfruttate solo da 1B/1C/1D), con RLS protettiva già attiva, così lo schema è sigillato fin da subito.
- **Helper SQL**: `is_supplier_member`, `supplier_member_role`, `has_supplier_permission` in `SECURITY DEFINER`.
- **Seed** matrice `role_permissions` completa (18 permessi × 4 ruoli).
- **Backfill non distruttivo**: per ogni supplier esistente → 1 `warehouse` primary, 1 `supplier_member` admin dal `profile_id`, 1 `price_list` default, 1 `ddt_template` default; per ogni `products` → 1 `product_sales_units` base e 1 `price_list_items` sul listino default con `products.price`.
- **UI 1A**: sezioni `/supplier/catalogo/*`, `/supplier/listini/*`, `/supplier/staff/*`, `/supplier/impostazioni/sedi/*`. Altre sezioni spec (magazzino, ordini, consegne, DDT, dashboard KPI) rimandate a 1B/1C/1D.
- **Feature flag**: tutte le nuove rotte gated via helper `isPhase1Enabled(supplier)`; fallback alla vecchia UI quando spento.

**Tech Stack:** Next.js 15 (App Router) · Supabase SSR · TypeScript strict · Tailwind v4 (dark-dashboard tokens) · Zod v4 · lucide-react · sonner · Resend (email inviti, già configurato altrove — verificare e riusare).

**Reference spec:** `docs/superpowers/specs/2026-04-15-admin-fornitore-fase1-design.md` (§§2, 3, 4.1, 4.2, 7 sono la fonte di verità per 1A).

**Testing model:** nessun framework unit test configurato. Ogni task termina con **manual verification** (browser + SQL console). Per le RLS una RPC di probe via Supabase SQL editor basta — la suite RLS automatica arriva in 1C.

**Conventions (seguire il codice esistente):**
- Server actions in `lib/<domain>/actions.ts` con direttiva `"use server"` e return shape `{ ok: true; data } | { ok: false; error: string }`.
- Supabase clients: `@/lib/supabase/client` (browser), `@/lib/supabase/server` (server), `@/lib/supabase/admin` (service role — solo per invio inviti e operazioni admin verificate).
- Zod v4 strict (`z` da `zod/v4`).
- Tutte le stringhe UI in italiano.
- Dark-dashboard tokens (`bg-surface-card`, `border-border-subtle`, `text-text-primary`, `accent-green`, `accent-amber`, `accent-red`).
- Riusare `DarkCard` e primitive già presenti in `components/dashboard/`.
- Icone `lucide-react` v1.6.0 (verificare prima di introdurre una nuova).
- Toast via `sonner`.
- Nessuna dependency nuova se non strettamente necessaria. Per email inviti riusare l'integrazione esistente se presente; altrimenti usare Supabase Auth `admin.inviteUserByEmail` + magic link.

**Distinzione con migrazioni già in repo**:
- `supplier_price_lists` (già esistente, `20260417000004`) è un *per-relazione* override — NON va toccato. Le nuove tabelle `price_lists` / `price_list_items` di questa fase sono **listini nominati del supplier** assegnabili a più clienti. Coesistono; eventuale consolidamento in Fase 2.

---

## File Structure

### Created
- `supabase/migrations/20260417100000_phase1_foundations.sql`
- `lib/supplier/permissions.ts` — enum dei permessi + helper client-side
- `lib/supplier/feature-flags.ts` — `isPhase1Enabled(supplier)`, `requirePhase1(supplierId)`
- `lib/supplier/context.ts` — `getActiveSupplierMember()`, `requireSupplierMember(supplierId)`, `requirePermission(supplierId, perm)`
- `lib/supplier/catalog/schemas.ts`
- `lib/supplier/catalog/actions.ts` — CRUD prodotto + sales_units
- `lib/supplier/pricing/schemas.ts`
- `lib/supplier/pricing/actions.ts` — CRUD listini + price_list_items
- `lib/supplier/staff/schemas.ts`
- `lib/supplier/staff/actions.ts` — invito, revoca, cambio ruolo, accettazione invito
- `lib/supplier/warehouses/schemas.ts`
- `lib/supplier/warehouses/actions.ts`
- `app/(supplier)/supplier/catalogo/nuovo/page.tsx`
- `app/(supplier)/supplier/catalogo/[id]/page.tsx`
- `app/(supplier)/supplier/catalogo/[id]/product-detail-client.tsx`
- `app/(supplier)/supplier/listini/page.tsx`
- `app/(supplier)/supplier/listini/listini-client.tsx`
- `app/(supplier)/supplier/listini/nuovo/page.tsx`
- `app/(supplier)/supplier/listini/[id]/page.tsx`
- `app/(supplier)/supplier/listini/[id]/price-list-editor-client.tsx`
- `app/(supplier)/supplier/staff/page.tsx`
- `app/(supplier)/supplier/staff/staff-client.tsx`
- `app/(supplier)/supplier/staff/nuovo/page.tsx`
- `app/(supplier)/supplier/impostazioni/sedi/page.tsx`
- `app/(supplier)/supplier/impostazioni/sedi/warehouses-client.tsx`
- `app/supplier/invito/[token]/page.tsx` — flow accept invito
- `components/supplier/shared/role-gate.tsx`
- `components/supplier/shared/feature-flag-gate.tsx`
- `components/supplier/catalog/sales-units-editor.tsx`
- `components/supplier/pricing/price-list-row.tsx`
- `components/supplier/staff/member-row.tsx`
- `components/supplier/staff/invite-form.tsx`
- `components/supplier/warehouses/warehouse-form.tsx`

### Modified
- `types/database.ts` — types generati/manuali per tutte le nuove tabelle + enum
- `app/(supplier)/supplier/catalogo/page.tsx` — ristrutturata come server component, linka a nuovo flow
- `app/(supplier)/layout.tsx` — sidebar con nuove voci + `<RoleGate>` + `<FeatureFlagGate>`

---

## Task 1 — Migrazione unica: enum + tabelle + RLS + helper + seed + backfill

**Files:**
- Create: `supabase/migrations/20260417100000_phase1_foundations.sql`

- [ ] **Step 1: Scrivere migration (unica transazione)**

File completo (copiabile a pezzi, in ordine). Tutto dentro `BEGIN; ... COMMIT;`.

1. **Enum** (§3.3 dello spec):

```sql
DO $$ BEGIN
  CREATE TYPE supplier_role AS ENUM ('admin', 'sales', 'warehouse', 'driver');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE unit_type AS ENUM ('piece', 'kg', 'g', 'l', 'ml', 'box', 'pallet', 'bundle', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE stock_movement_type AS ENUM ('receive','order_reserve','order_unreserve','order_ship','adjust_in','adjust_out','return','transfer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_line_status AS ENUM ('pending','accepted','modified','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_split_event_type AS ENUM ('received','accepted','partially_accepted','rejected','stock_conflict','preparing','packed','shipped','delivered','canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE delivery_status AS ENUM ('planned','loaded','in_transit','delivered','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ddt_causale AS ENUM ('sale','consignment','return','transfer','sample','cancel');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE promotion_type AS ENUM ('percentage','fixed_amount','bundle');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_channel AS ENUM ('email','push','sms');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_event AS ENUM ('order_received','order_accepted','order_shipped','order_delivered','stock_low','lot_expiring','delivery_failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

2. **Modifiche a tabelle esistenti** (§3.2):

```sql
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS fiscal_code text NULL,
  ADD COLUMN IF NOT EXISTS rea_number text NULL,
  ADD COLUMN IF NOT EXISTS sdi_code text NULL,
  ADD COLUMN IF NOT EXISTS default_ddt_template_id uuid NULL,
  ADD COLUMN IF NOT EXISTS feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS default_warehouse_id uuid NULL,
  ADD COLUMN IF NOT EXISTS hazard_class text NULL,
  ADD COLUMN IF NOT EXISTS tax_rate numeric NOT NULL DEFAULT 10;

ALTER TABLE order_splits
  ADD COLUMN IF NOT EXISTS warehouse_id uuid NULL,
  ADD COLUMN IF NOT EXISTS assigned_sales_member_id uuid NULL,
  ADD COLUMN IF NOT EXISTS expected_delivery_date date NULL,
  ADD COLUMN IF NOT EXISTS delivery_zone_id uuid NULL;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS sales_unit_id uuid NULL;

ALTER TABLE delivery_zones
  ADD COLUMN IF NOT EXISTS delivery_days int[] NULL,
  ADD COLUMN IF NOT EXISTS cutoff_time time NULL,
  ADD COLUMN IF NOT EXISTS delivery_slots jsonb NULL,
  ADD COLUMN IF NOT EXISTS warehouse_id uuid NULL;
```

3. **Nuove tabelle** (create prima quelle senza dipendenze):

```sql
-- warehouses
CREATE TABLE warehouses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id    uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name           text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  address        text NULL,
  city           text NULL,
  province       text NULL,
  zip_code       text NULL,
  latitude       numeric NULL,
  longitude      numeric NULL,
  is_primary     boolean NOT NULL DEFAULT false,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_warehouses_one_primary
  ON warehouses(supplier_id) WHERE is_primary = true;
CREATE INDEX idx_warehouses_supplier ON warehouses(supplier_id);

-- supplier_members
CREATE TABLE supplier_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id  uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  profile_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role         supplier_role NOT NULL,
  is_active    boolean NOT NULL DEFAULT true,
  invited_at   timestamptz NOT NULL DEFAULT now(),
  accepted_at  timestamptz NULL,
  invited_by   uuid NULL REFERENCES profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, profile_id)
);
CREATE INDEX idx_supplier_members_profile ON supplier_members(profile_id);
CREATE INDEX idx_supplier_members_supplier ON supplier_members(supplier_id);

-- role_permissions (seeded sotto)
CREATE TABLE role_permissions (
  role       supplier_role NOT NULL,
  permission text NOT NULL,
  PRIMARY KEY (role, permission)
);

-- product_sales_units
CREATE TABLE product_sales_units (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label               text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 60),
  unit_type           unit_type NOT NULL DEFAULT 'piece',
  conversion_to_base  numeric NOT NULL CHECK (conversion_to_base > 0),
  is_base             boolean NOT NULL DEFAULT false,
  barcode             text NULL,
  moq                 numeric NOT NULL DEFAULT 1 CHECK (moq > 0),
  sort_order          int NOT NULL DEFAULT 0,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_psu_one_base
  ON product_sales_units(product_id) WHERE is_base = true;
CREATE INDEX idx_psu_product ON product_sales_units(product_id);

-- Trigger: esattamente 1 base per product
CREATE OR REPLACE FUNCTION trg_psu_enforce_one_base()
RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.is_base = true THEN
    UPDATE product_sales_units
       SET is_base = false
     WHERE product_id = NEW.product_id
       AND id <> NEW.id
       AND is_base = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_psu_enforce_one_base
  BEFORE INSERT OR UPDATE ON product_sales_units
  FOR EACH ROW EXECUTE FUNCTION trg_psu_enforce_one_base();

-- stock_lots
CREATE TABLE stock_lots (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id              uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  warehouse_id            uuid NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  lot_code                text NOT NULL,
  expiry_date             date NULL,
  quantity_base           numeric NOT NULL DEFAULT 0 CHECK (quantity_base >= 0),
  quantity_reserved_base  numeric NOT NULL DEFAULT 0 CHECK (quantity_reserved_base >= 0),
  cost_per_base           numeric NULL,
  received_at             timestamptz NOT NULL DEFAULT now(),
  notes                   text NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  CHECK (quantity_reserved_base <= quantity_base)
);
CREATE INDEX idx_stock_lots_fefo
  ON stock_lots(product_id, warehouse_id, expiry_date NULLS LAST, received_at);

-- stock_movements
CREATE TABLE stock_movements (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id              uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  lot_id                  uuid NULL REFERENCES stock_lots(id) ON DELETE SET NULL,
  warehouse_id            uuid NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  quantity_base           numeric NOT NULL,
  movement_type           stock_movement_type NOT NULL,
  ref_order_split_id      uuid NULL,
  ref_delivery_item_id    uuid NULL,
  created_by_member_id    uuid NULL REFERENCES supplier_members(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  notes                   text NULL
);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id, created_at DESC);

-- price_lists
CREATE TABLE price_lists (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id  uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description  text NULL,
  is_default   boolean NOT NULL DEFAULT false,
  valid_from   date NULL,
  valid_to     date NULL,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_price_lists_one_default
  ON price_lists(supplier_id) WHERE is_default = true;
CREATE INDEX idx_price_lists_supplier ON price_lists(supplier_id);

-- price_list_items
CREATE TABLE price_list_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id   uuid NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sales_unit_id   uuid NOT NULL REFERENCES product_sales_units(id) ON DELETE CASCADE,
  price           numeric NOT NULL CHECK (price >= 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (price_list_id, product_id, sales_unit_id)
);

-- price_list_tier_discounts
CREATE TABLE price_list_tier_discounts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_item_id  uuid NOT NULL REFERENCES price_list_items(id) ON DELETE CASCADE,
  min_quantity        numeric NOT NULL CHECK (min_quantity > 0),
  discount_pct        numeric NOT NULL CHECK (discount_pct >= 0 AND discount_pct <= 100),
  sort_order          int NOT NULL DEFAULT 0,
  UNIQUE (price_list_item_id, min_quantity)
);

-- promotions
CREATE TABLE promotions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id  uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name         text NOT NULL,
  type         promotion_type NOT NULL,
  value        numeric NOT NULL,
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz NOT NULL,
  applies_to   text NOT NULL CHECK (applies_to IN ('all_catalog','categories','products','customers_segment')),
  filter_ids   uuid[] NULL,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- customer_price_assignments
CREATE TABLE customer_price_assignments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id    uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  restaurant_id  uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  price_list_id  uuid NOT NULL REFERENCES price_lists(id) ON DELETE RESTRICT,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, restaurant_id)
);

-- order_split_items
CREATE TABLE order_split_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_split_id      uuid NOT NULL REFERENCES order_splits(id) ON DELETE CASCADE,
  order_item_id       uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  sales_unit_id       uuid NULL REFERENCES product_sales_units(id) ON DELETE SET NULL,
  quantity_requested  numeric NOT NULL,
  quantity_accepted   numeric NULL,
  unit_price          numeric NOT NULL,
  status              order_line_status NOT NULL DEFAULT 'pending',
  rejection_reason    text NULL,
  notes               text NULL,
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_osi_split ON order_split_items(order_split_id);

-- order_split_events
CREATE TABLE order_split_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_split_id  uuid NOT NULL REFERENCES order_splits(id) ON DELETE CASCADE,
  event_type      order_split_event_type NOT NULL,
  member_id       uuid NULL REFERENCES supplier_members(id) ON DELETE SET NULL,
  note            text NULL,
  metadata        jsonb NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ose_split ON order_split_events(order_split_id, created_at);

-- deliveries
CREATE TABLE deliveries (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_split_id            uuid NOT NULL REFERENCES order_splits(id) ON DELETE CASCADE,
  warehouse_id              uuid NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  driver_member_id          uuid NULL REFERENCES supplier_members(id) ON DELETE SET NULL,
  scheduled_date            date NOT NULL,
  scheduled_slot            jsonb NULL,
  status                    delivery_status NOT NULL DEFAULT 'planned',
  delivered_at              timestamptz NULL,
  recipient_signature_url   text NULL,
  pod_photo_url             text NULL,
  failure_reason            text NULL,
  notes                     text NULL,
  created_at                timestamptz NOT NULL DEFAULT now()
);

-- delivery_items
CREATE TABLE delivery_items (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id             uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  order_split_item_id     uuid NOT NULL REFERENCES order_split_items(id) ON DELETE CASCADE,
  lot_id                  uuid NOT NULL REFERENCES stock_lots(id) ON DELETE RESTRICT,
  quantity_base           numeric NOT NULL,
  quantity_sales_unit     numeric NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- ddt_templates
CREATE TABLE ddt_templates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id      uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name             text NOT NULL,
  logo_url         text NULL,
  primary_color    text NULL,
  header_html      text NULL,
  footer_html      text NULL,
  conditions_text  text NULL,
  is_default       boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_ddt_templates_one_default
  ON ddt_templates(supplier_id) WHERE is_default = true;

-- ddt_documents
CREATE TABLE ddt_documents (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id          uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  delivery_id          uuid NOT NULL REFERENCES deliveries(id) ON DELETE RESTRICT,
  number               int NOT NULL,
  year                 int NOT NULL,
  causale              ddt_causale NOT NULL,
  issued_at            timestamptz NOT NULL DEFAULT now(),
  recipient_snapshot   jsonb NOT NULL,
  vettore              text NULL,
  peso_kg              numeric NULL,
  colli                int NULL,
  pdf_url              text NOT NULL,
  canceled_at          timestamptz NULL,
  canceled_reason      text NULL,
  template_id          uuid NULL REFERENCES ddt_templates(id),
  UNIQUE (supplier_id, year, number)
);

-- notification_preferences
CREATE TABLE notification_preferences (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_member_id  uuid NOT NULL REFERENCES supplier_members(id) ON DELETE CASCADE,
  channel             notification_channel NOT NULL,
  event_type          notification_event NOT NULL,
  enabled             boolean NOT NULL DEFAULT true,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_member_id, channel, event_type)
);

-- push_subscriptions
CREATE TABLE push_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint      text NOT NULL UNIQUE,
  p256dh        text NOT NULL,
  auth          text NOT NULL,
  user_agent    text NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz NULL
);
```

Ora i FK posticipati (per evitare cicli):

```sql
ALTER TABLE suppliers
  ADD CONSTRAINT fk_suppliers_default_ddt_template
  FOREIGN KEY (default_ddt_template_id) REFERENCES ddt_templates(id) ON DELETE SET NULL;

ALTER TABLE products
  ADD CONSTRAINT fk_products_default_warehouse
  FOREIGN KEY (default_warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL;

ALTER TABLE order_splits
  ADD CONSTRAINT fk_order_splits_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  ADD CONSTRAINT fk_order_splits_sales_member FOREIGN KEY (assigned_sales_member_id) REFERENCES supplier_members(id);

ALTER TABLE order_items
  ADD CONSTRAINT fk_order_items_sales_unit FOREIGN KEY (sales_unit_id) REFERENCES product_sales_units(id);

ALTER TABLE delivery_zones
  ADD CONSTRAINT fk_delivery_zones_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);

ALTER TABLE stock_movements
  ADD CONSTRAINT fk_sm_split FOREIGN KEY (ref_order_split_id) REFERENCES order_splits(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_sm_delivery_item FOREIGN KEY (ref_delivery_item_id) REFERENCES delivery_items(id) ON DELETE SET NULL;
```

4. **Seed `role_permissions`** (matrice completa §7.2 + permessi §3.1):

```sql
-- admin: tutti
INSERT INTO role_permissions(role, permission)
SELECT 'admin'::supplier_role, p FROM unnest(ARRAY[
  'order.read','order.accept_line','order.prepare',
  'pricing.read','pricing.edit',
  'catalog.read','catalog.edit',
  'stock.read','stock.receive','stock.adjust',
  'ddt.generate','ddt.manage_templates',
  'delivery.plan','delivery.execute',
  'staff.manage','settings.manage',
  'analytics.financial','reviews.reply'
]) AS p;

-- sales
INSERT INTO role_permissions(role, permission)
SELECT 'sales'::supplier_role, p FROM unnest(ARRAY[
  'order.read','order.accept_line',
  'catalog.read','catalog.edit',
  'pricing.read','pricing.edit',
  'delivery.plan',
  'analytics.financial','reviews.reply'
]) AS p;

-- warehouse
INSERT INTO role_permissions(role, permission)
SELECT 'warehouse'::supplier_role, p FROM unnest(ARRAY[
  'order.read','order.prepare',
  'catalog.read',
  'stock.read','stock.receive','stock.adjust',
  'ddt.generate',
  'delivery.execute'
]) AS p;

-- driver
INSERT INTO role_permissions(role, permission)
SELECT 'driver'::supplier_role, p FROM unnest(ARRAY[
  'order.read',
  'delivery.execute'
]) AS p;
```

5. **Helper RPC** (`SECURITY DEFINER`, `SET search_path = public`):

```sql
CREATE OR REPLACE FUNCTION is_supplier_member(p_supplier_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM supplier_members sm
    WHERE sm.supplier_id = p_supplier_id
      AND sm.profile_id  = auth.uid()
      AND sm.is_active   = true
      AND sm.accepted_at IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION supplier_member_role(p_supplier_id uuid)
RETURNS supplier_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM supplier_members
   WHERE supplier_id = p_supplier_id
     AND profile_id  = auth.uid()
     AND is_active   = true
     AND accepted_at IS NOT NULL
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION has_supplier_permission(p_supplier_id uuid, p_permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM supplier_members sm
      JOIN role_permissions rp ON rp.role = sm.role
     WHERE sm.supplier_id = p_supplier_id
       AND sm.profile_id  = auth.uid()
       AND sm.is_active   = true
       AND sm.accepted_at IS NOT NULL
       AND rp.permission  = p_permission
  );
$$;

GRANT EXECUTE ON FUNCTION is_supplier_member(uuid),
                         supplier_member_role(uuid),
                         has_supplier_permission(uuid, text)
  TO authenticated;
```

6. **Backfill** (ordine: `warehouses` → `supplier_members` → `product_sales_units` → `price_lists` → `price_list_items` → `ddt_templates` → `customer_price_assignments`):

```sql
-- 1 warehouse primary per supplier
INSERT INTO warehouses (supplier_id, name, address, city, province, zip_code, is_primary, is_active)
SELECT s.id, COALESCE(s.company_name, 'Sede principale'),
       s.address, s.city, s.province, s.zip_code, true, true
  FROM suppliers s
 WHERE NOT EXISTS (SELECT 1 FROM warehouses w WHERE w.supplier_id = s.id);

-- supplier_members: admin dal profile_id del supplier
INSERT INTO supplier_members (supplier_id, profile_id, role, is_active, accepted_at)
SELECT s.id, s.profile_id, 'admin', true, now()
  FROM suppliers s
 WHERE s.profile_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM supplier_members sm
      WHERE sm.supplier_id = s.id AND sm.profile_id = s.profile_id
   );

-- product_sales_units: una base per ogni product
INSERT INTO product_sales_units (product_id, label, unit_type, conversion_to_base, is_base, moq)
SELECT p.id,
       COALESCE(p.unit, 'pezzo'),
       'piece'::unit_type,
       1,
       true,
       COALESCE(p.min_quantity, 1)
  FROM products p
 WHERE NOT EXISTS (
   SELECT 1 FROM product_sales_units psu
    WHERE psu.product_id = p.id AND psu.is_base = true
 );

-- price_lists: 1 default per supplier
INSERT INTO price_lists (supplier_id, name, is_default, is_active)
SELECT s.id, 'Listino Base', true, true
  FROM suppliers s
 WHERE NOT EXISTS (
   SELECT 1 FROM price_lists pl WHERE pl.supplier_id = s.id AND pl.is_default = true
 );

-- price_list_items: riga base per ogni products sul listino default
INSERT INTO price_list_items (price_list_id, product_id, sales_unit_id, price)
SELECT pl.id, p.id, psu.id, p.price
  FROM products p
  JOIN price_lists pl ON pl.supplier_id = p.supplier_id AND pl.is_default = true
  JOIN product_sales_units psu ON psu.product_id = p.id AND psu.is_base = true
 WHERE NOT EXISTS (
   SELECT 1 FROM price_list_items pli
    WHERE pli.price_list_id = pl.id
      AND pli.product_id = p.id
      AND pli.sales_unit_id = psu.id
 );

-- ddt_templates: default per supplier
INSERT INTO ddt_templates (supplier_id, name, logo_url, is_default)
SELECT s.id, 'Template Predefinito', s.logo_url, true
  FROM suppliers s
 WHERE NOT EXISTS (
   SELECT 1 FROM ddt_templates t WHERE t.supplier_id = s.id AND t.is_default = true
 );

UPDATE suppliers s
   SET default_ddt_template_id = t.id
  FROM ddt_templates t
 WHERE t.supplier_id = s.id
   AND t.is_default = true
   AND s.default_ddt_template_id IS NULL;

-- products.default_warehouse_id = warehouse primary
UPDATE products p
   SET default_warehouse_id = w.id
  FROM warehouses w
 WHERE w.supplier_id = p.supplier_id
   AND w.is_primary = true
   AND p.default_warehouse_id IS NULL;

-- customer_price_assignments: ogni restaurant con ordini storici → default
INSERT INTO customer_price_assignments (supplier_id, restaurant_id, price_list_id)
SELECT DISTINCT os.supplier_id, o.restaurant_id, pl.id
  FROM order_splits os
  JOIN orders o ON o.id = os.order_id
  JOIN price_lists pl ON pl.supplier_id = os.supplier_id AND pl.is_default = true
 WHERE NOT EXISTS (
   SELECT 1 FROM customer_price_assignments cpa
    WHERE cpa.supplier_id = os.supplier_id
      AND cpa.restaurant_id = o.restaurant_id
 );
```

7. **RLS — abilita su TUTTE le nuove tabelle, poi policy**:

```sql
ALTER TABLE warehouses                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_sales_units        ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_lots                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements            ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_lists                ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_list_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_list_tier_discounts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_price_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_split_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_split_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ddt_documents              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ddt_templates              ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences   ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions         ENABLE ROW LEVEL SECURITY;
```

Policies (pattern per-tabella — per brevità qui solo i casi salienti; le restanti seguono lo stesso stile):

```sql
-- role_permissions: lettura authenticated
CREATE POLICY "role_permissions read all authenticated"
  ON role_permissions FOR SELECT TO authenticated USING (true);

-- warehouses
CREATE POLICY "warehouses member read"
  ON warehouses FOR SELECT
  USING (is_supplier_member(supplier_id));
CREATE POLICY "warehouses admin manage"
  ON warehouses FOR ALL
  USING (has_supplier_permission(supplier_id, 'settings.manage'))
  WITH CHECK (has_supplier_permission(supplier_id, 'settings.manage'));

-- supplier_members
CREATE POLICY "supplier_members self read"
  ON supplier_members FOR SELECT
  USING (profile_id = auth.uid() OR is_supplier_member(supplier_id));
CREATE POLICY "supplier_members admin manage"
  ON supplier_members FOR ALL
  USING (has_supplier_permission(supplier_id, 'staff.manage'))
  WITH CHECK (has_supplier_permission(supplier_id, 'staff.manage'));

-- product_sales_units (via product → supplier)
CREATE POLICY "psu member read"
  ON product_sales_units FOR SELECT
  USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_sales_units.product_id AND is_supplier_member(p.supplier_id)));
CREATE POLICY "psu catalog edit"
  ON product_sales_units FOR ALL
  USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_sales_units.product_id AND has_supplier_permission(p.supplier_id, 'catalog.edit')))
  WITH CHECK (EXISTS (SELECT 1 FROM products p WHERE p.id = product_sales_units.product_id AND has_supplier_permission(p.supplier_id, 'catalog.edit')));

-- price_lists & items
CREATE POLICY "price_lists member read"
  ON price_lists FOR SELECT USING (is_supplier_member(supplier_id));
CREATE POLICY "price_lists pricing edit"
  ON price_lists FOR ALL
  USING (has_supplier_permission(supplier_id, 'pricing.edit'))
  WITH CHECK (has_supplier_permission(supplier_id, 'pricing.edit'));

CREATE POLICY "price_list_items member read"
  ON price_list_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM price_lists pl WHERE pl.id = price_list_id AND is_supplier_member(pl.supplier_id)));
CREATE POLICY "price_list_items pricing edit"
  ON price_list_items FOR ALL
  USING (EXISTS (SELECT 1 FROM price_lists pl WHERE pl.id = price_list_id AND has_supplier_permission(pl.supplier_id, 'pricing.edit')))
  WITH CHECK (EXISTS (SELECT 1 FROM price_lists pl WHERE pl.id = price_list_id AND has_supplier_permission(pl.supplier_id, 'pricing.edit')));

-- price_list_tier_discounts: stesso pattern via parent item
CREATE POLICY "pltd pricing manage"
  ON price_list_tier_discounts FOR ALL
  USING (EXISTS (SELECT 1 FROM price_list_items pli JOIN price_lists pl ON pl.id = pli.price_list_id WHERE pli.id = price_list_item_id AND has_supplier_permission(pl.supplier_id, 'pricing.edit')))
  WITH CHECK (EXISTS (SELECT 1 FROM price_list_items pli JOIN price_lists pl ON pl.id = pli.price_list_id WHERE pli.id = price_list_item_id AND has_supplier_permission(pl.supplier_id, 'pricing.edit')));

-- stock_lots / stock_movements: via warehouse → supplier
CREATE POLICY "stock_lots member read"
  ON stock_lots FOR SELECT
  USING (EXISTS (SELECT 1 FROM warehouses w WHERE w.id = warehouse_id AND is_supplier_member(w.supplier_id)));
CREATE POLICY "stock_lots manage"
  ON stock_lots FOR ALL
  USING (EXISTS (SELECT 1 FROM warehouses w WHERE w.id = warehouse_id AND (has_supplier_permission(w.supplier_id,'stock.receive') OR has_supplier_permission(w.supplier_id,'stock.adjust'))))
  WITH CHECK (EXISTS (SELECT 1 FROM warehouses w WHERE w.id = warehouse_id AND (has_supplier_permission(w.supplier_id,'stock.receive') OR has_supplier_permission(w.supplier_id,'stock.adjust'))));

CREATE POLICY "stock_movements member read"
  ON stock_movements FOR SELECT
  USING (EXISTS (SELECT 1 FROM warehouses w WHERE w.id = warehouse_id AND is_supplier_member(w.supplier_id)));
CREATE POLICY "stock_movements insert"
  ON stock_movements FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM warehouses w WHERE w.id = warehouse_id AND (has_supplier_permission(w.supplier_id,'stock.receive') OR has_supplier_permission(w.supplier_id,'stock.adjust'))));

-- promotions
CREATE POLICY "promotions pricing manage"
  ON promotions FOR ALL
  USING (has_supplier_permission(supplier_id,'pricing.edit'))
  WITH CHECK (has_supplier_permission(supplier_id,'pricing.edit'));
CREATE POLICY "promotions public read active"
  ON promotions FOR SELECT TO authenticated
  USING (is_active = true AND now() BETWEEN starts_at AND ends_at);

-- customer_price_assignments
CREATE POLICY "cpa supplier manage"
  ON customer_price_assignments FOR ALL
  USING (has_supplier_permission(supplier_id,'pricing.edit'))
  WITH CHECK (has_supplier_permission(supplier_id,'pricing.edit'));
CREATE POLICY "cpa restaurant read own"
  ON customer_price_assignments FOR SELECT
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE profile_id = auth.uid()));

-- order_split_items / events (via order_splits → supplier_id)
CREATE POLICY "osi member read"
  ON order_split_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM order_splits os WHERE os.id = order_split_id AND is_supplier_member(os.supplier_id)));
CREATE POLICY "osi accept update"
  ON order_split_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM order_splits os WHERE os.id = order_split_id AND has_supplier_permission(os.supplier_id,'order.accept_line')))
  WITH CHECK (EXISTS (SELECT 1 FROM order_splits os WHERE os.id = order_split_id AND has_supplier_permission(os.supplier_id,'order.accept_line')));
CREATE POLICY "osi insert"
  ON order_split_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM order_splits os WHERE os.id = order_split_id AND is_supplier_member(os.supplier_id)));

CREATE POLICY "ose member read"
  ON order_split_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM order_splits os WHERE os.id = order_split_id AND is_supplier_member(os.supplier_id)));
CREATE POLICY "ose insert"
  ON order_split_events FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM order_splits os WHERE os.id = order_split_id AND is_supplier_member(os.supplier_id)));

-- deliveries / delivery_items
CREATE POLICY "deliveries member read"
  ON deliveries FOR SELECT
  USING (EXISTS (SELECT 1 FROM warehouses w WHERE w.id = warehouse_id AND is_supplier_member(w.supplier_id)));
CREATE POLICY "deliveries plan"
  ON deliveries FOR ALL
  USING (EXISTS (SELECT 1 FROM warehouses w WHERE w.id = warehouse_id AND (has_supplier_permission(w.supplier_id,'delivery.plan') OR has_supplier_permission(w.supplier_id,'delivery.execute'))))
  WITH CHECK (EXISTS (SELECT 1 FROM warehouses w WHERE w.id = warehouse_id AND (has_supplier_permission(w.supplier_id,'delivery.plan') OR has_supplier_permission(w.supplier_id,'delivery.execute'))));

CREATE POLICY "delivery_items member read"
  ON delivery_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM deliveries d JOIN warehouses w ON w.id = d.warehouse_id WHERE d.id = delivery_id AND is_supplier_member(w.supplier_id)));
CREATE POLICY "delivery_items insert"
  ON delivery_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM deliveries d JOIN warehouses w ON w.id = d.warehouse_id WHERE d.id = delivery_id AND has_supplier_permission(w.supplier_id,'delivery.execute')));

-- ddt_templates / ddt_documents (ddt immutabili: solo INSERT)
CREATE POLICY "ddt_templates manage"
  ON ddt_templates FOR ALL
  USING (has_supplier_permission(supplier_id,'ddt.manage_templates'))
  WITH CHECK (has_supplier_permission(supplier_id,'ddt.manage_templates'));
CREATE POLICY "ddt_templates member read"
  ON ddt_templates FOR SELECT USING (is_supplier_member(supplier_id));

CREATE POLICY "ddt_documents member read"
  ON ddt_documents FOR SELECT USING (is_supplier_member(supplier_id));
CREATE POLICY "ddt_documents insert"
  ON ddt_documents FOR INSERT
  WITH CHECK (has_supplier_permission(supplier_id,'ddt.generate'));
-- NIENTE UPDATE/DELETE policy → DDT immutabili.

-- notification_preferences
CREATE POLICY "np self manage"
  ON notification_preferences FOR ALL
  USING (EXISTS (SELECT 1 FROM supplier_members sm WHERE sm.id = supplier_member_id AND sm.profile_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM supplier_members sm WHERE sm.id = supplier_member_id AND sm.profile_id = auth.uid()));

-- push_subscriptions
CREATE POLICY "push_subs self manage"
  ON push_subscriptions FOR ALL
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
```

- [ ] **Step 2: Applicare la migration in locale**

```bash
npx supabase db reset
```

Risultato atteso: tutte le migrazioni passano senza errori.

- [ ] **Step 3: Verifiche SQL**

In Supabase Studio → SQL editor eseguire:

```sql
-- 1. enum presenti
SELECT typname FROM pg_type WHERE typname IN
 ('supplier_role','unit_type','stock_movement_type','order_line_status',
  'order_split_event_type','delivery_status','ddt_causale','promotion_type',
  'notification_channel','notification_event');

-- 2. tabelle presenti
SELECT tablename FROM pg_tables
 WHERE schemaname = 'public'
   AND tablename IN ('warehouses','supplier_members','role_permissions','product_sales_units',
                     'stock_lots','stock_movements','price_lists','price_list_items',
                     'price_list_tier_discounts','promotions','customer_price_assignments',
                     'order_split_items','order_split_events','deliveries','delivery_items',
                     'ddt_documents','ddt_templates','notification_preferences','push_subscriptions')
 ORDER BY tablename;

-- 3. seed matrice permessi
SELECT role, count(*) FROM role_permissions GROUP BY role ORDER BY role;
-- atteso: admin=18, sales=9, warehouse=8, driver=2

-- 4. backfill: per ogni supplier esiste 1 warehouse primary, 1 member admin, 1 price_list default, 1 ddt_template default
SELECT
  (SELECT count(*) FROM suppliers)                                         AS suppliers,
  (SELECT count(*) FROM warehouses WHERE is_primary)                       AS warehouses_primary,
  (SELECT count(*) FROM supplier_members WHERE role='admin')               AS admin_members,
  (SELECT count(*) FROM price_lists WHERE is_default)                      AS price_lists_default,
  (SELECT count(*) FROM ddt_templates WHERE is_default)                    AS ddt_templates_default;
-- tutti i 4 contatori devono essere uguali al count di suppliers

-- 5. backfill prodotti
SELECT
  (SELECT count(*) FROM products)                                       AS products,
  (SELECT count(*) FROM product_sales_units WHERE is_base)              AS psu_base,
  (SELECT count(*) FROM price_list_items)                               AS pli;
-- psu_base = products, pli ≥ products

-- 6. helper RPC — smoke test come utente authenticated noto
SELECT is_supplier_member('<SOME_SUPPLIER_ID>');
SELECT supplier_member_role('<SOME_SUPPLIER_ID>');
SELECT has_supplier_permission('<SOME_SUPPLIER_ID>', 'catalog.edit');
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260417100000_phase1_foundations.sql
git commit -m "feat(db): fase 1 foundations — schema, RLS, helper RPC, role_permissions, backfill"
```

---

## Task 2 — TypeScript types

**Files:**
- Modify: `types/database.ts`

- [ ] **Step 1: Rigenerare (o aggiornare a mano) i types**

Se il progetto usa `supabase gen types`:

```bash
npx supabase gen types typescript --local > types/database.ts
```

Altrimenti aggiungere a mano le interfacce per: `warehouses`, `supplier_members`, `role_permissions`, `product_sales_units`, `stock_lots`, `stock_movements`, `price_lists`, `price_list_items`, `price_list_tier_discounts`, `promotions`, `customer_price_assignments`, `order_split_items`, `order_split_events`, `deliveries`, `delivery_items`, `ddt_templates`, `ddt_documents`, `notification_preferences`, `push_subscriptions`.

Esportare anche:

```ts
export type SupplierRole = 'admin' | 'sales' | 'warehouse' | 'driver';
export type SupplierPermission =
  | 'order.read' | 'order.accept_line' | 'order.prepare'
  | 'pricing.read' | 'pricing.edit'
  | 'catalog.read' | 'catalog.edit'
  | 'stock.read' | 'stock.receive' | 'stock.adjust'
  | 'ddt.generate' | 'ddt.manage_templates'
  | 'delivery.plan' | 'delivery.execute'
  | 'staff.manage' | 'settings.manage'
  | 'analytics.financial' | 'reviews.reply';
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Atteso: zero nuovi errori.

- [ ] **Step 3: Commit**

```bash
git add types/database.ts
git commit -m "feat(types): aggiungi tipi fase 1 foundations"
```

---

## Task 3 — Helper app-side: permissions, feature flag, context

**Files:**
- Create: `lib/supplier/permissions.ts`
- Create: `lib/supplier/feature-flags.ts`
- Create: `lib/supplier/context.ts`

- [ ] **Step 1: `permissions.ts`**

```ts
import type { SupplierRole, SupplierPermission } from "@/types/database";

export const ROLE_LABELS: Record<SupplierRole, string> = {
  admin:     "Amministratore",
  sales:     "Commerciale",
  warehouse: "Magazziniere",
  driver:    "Autista",
};

// Mirror del seed — utile lato client per disabilitare CTA prima del round-trip.
// RLS rimane l'unico gate autoritativo.
export const ROLE_MATRIX: Record<SupplierRole, SupplierPermission[]> = {
  admin: [
    "order.read","order.accept_line","order.prepare",
    "pricing.read","pricing.edit",
    "catalog.read","catalog.edit",
    "stock.read","stock.receive","stock.adjust",
    "ddt.generate","ddt.manage_templates",
    "delivery.plan","delivery.execute",
    "staff.manage","settings.manage",
    "analytics.financial","reviews.reply",
  ],
  sales: ["order.read","order.accept_line","catalog.read","catalog.edit",
          "pricing.read","pricing.edit","delivery.plan","analytics.financial","reviews.reply"],
  warehouse: ["order.read","order.prepare","catalog.read","stock.read",
              "stock.receive","stock.adjust","ddt.generate","delivery.execute"],
  driver: ["order.read","delivery.execute"],
};

export function hasPermission(role: SupplierRole, perm: SupplierPermission): boolean {
  return ROLE_MATRIX[role].includes(perm);
}
```

- [ ] **Step 2: `feature-flags.ts`**

```ts
import type { Database } from "@/types/database";

type SupplierRow = Database["public"]["Tables"]["suppliers"]["Row"];

export function isPhase1Enabled(supplier: Pick<SupplierRow,"feature_flags"> | null | undefined): boolean {
  if (!supplier?.feature_flags) return false;
  const flags = supplier.feature_flags as Record<string, unknown>;
  return flags.phase1_enabled === true;
}
```

- [ ] **Step 3: `context.ts`**

Fornisce helper server-side per risolvere il `supplier_member` corrente e gatare server actions:

```ts
"use server";
import { createClient } from "@/lib/supabase/server";

export async function getActiveSupplierMember(supplierId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("supplier_members")
    .select("id, role, supplier_id")
    .eq("supplier_id", supplierId)
    .eq("profile_id", user.id)
    .eq("is_active", true)
    .not("accepted_at", "is", null)
    .maybeSingle();
  return data;
}

export async function requireSupplierMember(supplierId: string) {
  const m = await getActiveSupplierMember(supplierId);
  if (!m) throw new Error("Non sei membro di questo fornitore");
  return m;
}

export async function requirePermission(supplierId: string, permission: string) {
  const supabase = createClient();
  const { data } = await supabase.rpc("has_supplier_permission", {
    p_supplier_id: supplierId, p_permission: permission,
  });
  if (!data) throw new Error(`Permesso mancante: ${permission}`);
}
```

- [ ] **Step 4: Verifica**

Nessuna rotta chiama ancora questi helper → il build deve passare:

```bash
npx tsc --noEmit && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add lib/supplier/
git commit -m "feat(supplier): helper permessi, feature flag, context membro attivo"
```

---

## Task 4 — Gates UI: RoleGate e FeatureFlagGate

**Files:**
- Create: `components/supplier/shared/role-gate.tsx`
- Create: `components/supplier/shared/feature-flag-gate.tsx`
- Modify: `app/(supplier)/layout.tsx`

- [ ] **Step 1: `role-gate.tsx`**

```tsx
import type { SupplierRole } from "@/types/database";

export function RoleGate({
  currentRole, allowed, children, fallback = null,
}: {
  currentRole: SupplierRole | null;
  allowed: SupplierRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  if (!currentRole || !allowed.includes(currentRole)) return <>{fallback}</>;
  return <>{children}</>;
}
```

- [ ] **Step 2: `feature-flag-gate.tsx`**

Server component: se feature flag spento renderizza fallback (o redirect a UI legacy).

- [ ] **Step 3: Modificare `app/(supplier)/layout.tsx`**

- Caricare supplier corrente + `supplier_members` del profilo.
- Se più di un supplier associato → supplier-switcher (rinviato a 1B, per ora basta il primo attivo).
- Passare `currentRole` al menu laterale.
- Aggiungere voci sidebar (gated):
  - `Catalogo` (catalog.read)
  - `Listini` (pricing.read) — solo se `phase1_enabled`
  - `Staff` (staff.manage) — solo se `phase1_enabled`
  - `Impostazioni → Sedi` (settings.manage) — solo se `phase1_enabled`
- Tenere le voci vecchie funzionanti finché `phase1_enabled=false`.

- [ ] **Manual verification**
  1. Utente admin → vede tutte le voci.
  2. Utente warehouse (creato manualmente via SQL) → vede solo Catalogo (read).
  3. Toggle `suppliers.feature_flags = '{"phase1_enabled": true}'::jsonb` → compaiono Listini / Staff / Sedi.

- [ ] **Step 4: Commit**

```bash
git add components/supplier/shared/ app/\(supplier\)/layout.tsx
git commit -m "feat(supplier): RoleGate + FeatureFlagGate e sidebar aggiornata"
```

---

## Task 5 — Schemas Zod e server actions catalogo (sales_units)

**Files:**
- Create: `lib/supplier/catalog/schemas.ts`
- Create: `lib/supplier/catalog/actions.ts`

- [ ] **Step 1: `schemas.ts`**

```ts
import { z } from "zod/v4";

export const SalesUnitSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(60),
  unit_type: z.enum(['piece','kg','g','l','ml','box','pallet','bundle','other']),
  conversion_to_base: z.number().positive(),
  is_base: z.boolean(),
  barcode: z.string().trim().max(64).nullish(),
  moq: z.number().positive().default(1),
  sort_order: z.number().int().nonnegative().default(0),
  is_active: z.boolean().default(true),
});

export const SalesUnitsArraySchema = z.array(SalesUnitSchema)
  .min(1, "Almeno una unità richiesta")
  .refine(arr => arr.filter(u => u.is_base).length === 1, {
    message: "Esattamente una unità deve essere base",
  });

export type SalesUnitInput = z.infer<typeof SalesUnitSchema>;
```

- [ ] **Step 2: `actions.ts`**

`"use server"`. Implementare:

- `upsertSalesUnits(productId: string, units: SalesUnitInput[])`:
  1. risolvere `supplier_id` dal product
  2. `requirePermission(supplier_id, 'catalog.edit')`
  3. validare array con `SalesUnitsArraySchema`
  4. diff vs DB: insert nuovi, update esistenti, delete rimossi
  5. restituire `{ ok: true, data: SalesUnitRow[] }` — altrimenti `{ ok: false, error }`

- `updateProductBase(productId, patch)` con campi `default_warehouse_id`, `hazard_class`, `tax_rate` (oltre ai campi già esistenti). Permesso `catalog.edit`.

- [ ] **Manual verification**
  - Dopo aver implementato la UI (Task 6), testare: creare 2 unità ("pezzo", "cartone 6pz" conversion 6), salvare, ricaricare, valori persistono. Impostare "cartone" come base → il vecchio base passa a `is_base=false`.

- [ ] **Step 3: Commit**

```bash
git add lib/supplier/catalog/
git commit -m "feat(catalog): schemas e actions sales_units"
```

---

## Task 6 — UI catalogo: detail con sales_units editor

**Files:**
- Modify: `app/(supplier)/supplier/catalogo/page.tsx`
- Create: `app/(supplier)/supplier/catalogo/[id]/page.tsx`
- Create: `app/(supplier)/supplier/catalogo/[id]/product-detail-client.tsx`
- Create: `app/(supplier)/supplier/catalogo/nuovo/page.tsx`
- Create: `components/supplier/catalog/sales-units-editor.tsx`

- [ ] **Step 1: Lista `catalogo/page.tsx`** — server component che carica prodotti del supplier + conta sales_units; CTA "Nuovo prodotto" e link a detail `/supplier/catalogo/[id]`.

- [ ] **Step 2: Detail page** — server component: fetch `products` + `product_sales_units` (sort_order asc), passa tutto al client.

- [ ] **Step 3: `product-detail-client.tsx`** — due tab: **Generali** (campi anagrafici esistenti + `tax_rate`, `hazard_class`, `default_warehouse_id` dropdown su warehouses del supplier) e **Unità di vendita** (renderizza `<SalesUnitsEditor />`).

- [ ] **Step 4: `sales-units-editor.tsx`**

Tabella editabile con righe:
- `label` text
- `unit_type` select
- `conversion_to_base` number
- `is_base` radio (singleton)
- `barcode` text (opz)
- `moq` number
- azioni: duplica, rimuovi (disabilitata se `is_base`)

Bottoni "Aggiungi unità" e "Salva". Salvataggio via `upsertSalesUnits`. Mostrare suggerimento live: `12,50 €/cartone (≈ 2,08 €/pezzo)` calcolando da listino default (in 1A: informativo; il vero binding listino è nel task 7).

- [ ] **Step 5: `catalogo/nuovo/page.tsx`** — wizard 1-step che crea il product + crea subito 1 `product_sales_units` base con conversion=1 + 1 riga su listino default. Riusare form prodotto esistente se presente.

- [ ] **Manual verification**
  1. Creare nuovo prodotto "Olio EVO 5L". Dopo submit si crea product + psu base "bottiglia" conversion 1 + price_list_items sul listino default.
  2. Aprire detail, aggiungere unità "cartone 6 bottiglie" conversion 6, salvare. In DB entrambe righe presenti, base ancora solo 1.
  3. Cambiare base su "cartone" → vecchio base si aggiorna a false via trigger.

- [ ] **Step 6: Commit**

```bash
git add app/\(supplier\)/supplier/catalogo/ components/supplier/catalog/
git commit -m "feat(catalog): UI dettaglio prodotto con editor sales_units"
```

---

## Task 7 — Schemas Zod e server actions listini

**Files:**
- Create: `lib/supplier/pricing/schemas.ts`
- Create: `lib/supplier/pricing/actions.ts`

- [ ] **Step 1: Schemas**

```ts
import { z } from "zod/v4";

export const PriceListSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).nullish(),
  is_default: z.boolean().default(false),
  valid_from: z.string().date().nullish(),
  valid_to:   z.string().date().nullish(),
  is_active:  z.boolean().default(true),
});

export const PriceListItemPatchSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid(),
  sales_unit_id: z.string().uuid(),
  price: z.number().nonnegative(),
});
```

- [ ] **Step 2: Actions**

- `createPriceList(supplierId, input)` — permesso `pricing.edit`. Se `is_default=true` → azzerare il flag su qualunque altro listino default dello stesso supplier (nel caso il trigger unique index non sia sufficiente: farlo in una unica transazione via RPC o via due update consecutivi).
- `updatePriceList(listId, patch)` — stesso pattern.
- `deletePriceList(listId)` — rifiutare se `is_default`.
- `upsertPriceListItem(input)` — genera la riga se manca, altrimenti update. Permesso `pricing.edit`.
- `bulkUpdatePrices(listId, mode: 'percent'|'fixed', value, filter?: {category_id?})` — applica aumento/decremento.
- `duplicatePriceList(sourceId, newName)` — copia struttura + items.

Return shape `{ ok, data | error }`.

- [ ] **Step 3: Commit**

```bash
git add lib/supplier/pricing/
git commit -m "feat(pricing): schemas e actions listini"
```

---

## Task 8 — UI listini: lista + editor base

**Files:**
- Create: `app/(supplier)/supplier/listini/page.tsx`
- Create: `app/(supplier)/supplier/listini/listini-client.tsx`
- Create: `app/(supplier)/supplier/listini/nuovo/page.tsx`
- Create: `app/(supplier)/supplier/listini/[id]/page.tsx`
- Create: `app/(supplier)/supplier/listini/[id]/price-list-editor-client.tsx`
- Create: `components/supplier/pricing/price-list-row.tsx`

- [ ] **Step 1: Lista**

Server component fetches `price_lists` del supplier con count `price_list_items` e count clienti assegnati (`customer_price_assignments`). Render tabella dark (`bg-surface-card border border-border-subtle`) con colonne: Nome, Default, Validità, Prodotti, Clienti, Azioni.

- [ ] **Step 2: Editor**

Page `listini/[id]/page.tsx` carica `price_list` + `price_list_items` join `products + product_sales_units` sorted by category → product → sales_unit. Passa al client.

`price-list-editor-client.tsx`:
- Header con nome listino, flag default, validità, toggle attivo.
- Tabella con righe `{ product, sales_unit, price input }`.
- **Editor base (no virtualization in 1A)** — usare paginazione client `react-window` NON richiesta: se >200 righe mostrare paginazione server 50 per pagina. Input numerico con `onBlur` debounce 600ms → `upsertPriceListItem`.
- Toolbar bulk: "+ X%", "- X%", "Copia da altro listino" (modale).
- Indicator inline di "salvato" / "errore" per riga (sonner toast + badge).

- [ ] **Step 3: Nuovo listino**

Form con name, validità, checkbox default. Submit → `createPriceList` → redirect all'editor con seed righe = prodotti attivi del supplier al prezzo del listino default (se esiste) o 0 (chiedere conferma).

- [ ] **Manual verification**
  1. Listino di default esistente post-migration ha tutte le righe backfill.
  2. Creare "Listino Estate 2026" non default → vuoto. Seed dal default. Editare alcuni prezzi, verificare persistenza.
  3. Bulk +10% → prezzi aggiornati nel DB con il nuovo valore.
  4. Tentare di impostare 2 listini default → UI permette il toggle, backend garantisce atomicamente esattamente 1.
  5. Eliminare listino default → errore visibile.

- [ ] **Step 4: Commit**

```bash
git add app/\(supplier\)/supplier/listini/ components/supplier/pricing/
git commit -m "feat(pricing): UI listini con editor base e bulk update"
```

---

## Task 9 — Backward compat: sincronizzazione `products.price`

**Files:**
- Modify: `supabase/migrations/20260417100000_phase1_foundations.sql` (aggiungere trigger a fine migration se non già incluso — in alternativa creare nuova migration `20260417110000_products_price_sync.sql`)

Obiettivo: finché la UI legacy e il flusso ordine cliente leggono `products.price` e `products.unit`, manteniamo questi campi allineati al listino default + sales_unit base.

- [ ] **Step 1: Trigger**

```sql
CREATE OR REPLACE FUNCTION sync_products_price_from_default_list()
RETURNS trigger AS $$
DECLARE
  v_price numeric;
BEGIN
  -- prezzo del listino default per il product.sales_unit base
  SELECT pli.price INTO v_price
    FROM price_list_items pli
    JOIN price_lists pl ON pl.id = pli.price_list_id AND pl.is_default = true
    JOIN product_sales_units psu ON psu.id = pli.sales_unit_id AND psu.is_base = true
   WHERE pli.product_id = NEW.product_id
   LIMIT 1;

  IF v_price IS NOT NULL THEN
    UPDATE products SET price = v_price WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_products_price
  AFTER INSERT OR UPDATE OF price ON price_list_items
  FOR EACH ROW EXECUTE FUNCTION sync_products_price_from_default_list();
```

- [ ] **Step 2: Manual verification**
  - Cambiare un prezzo sul listino default via UI → `products.price` nel DB riflette il nuovo valore.
  - Cambiare un prezzo su listino non-default → `products.price` invariato.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): sync products.price da listino default (back-compat)"
```

---

## Task 10 — Schemas/actions warehouses + UI sedi

**Files:**
- Create: `lib/supplier/warehouses/schemas.ts`
- Create: `lib/supplier/warehouses/actions.ts`
- Create: `app/(supplier)/supplier/impostazioni/sedi/page.tsx`
- Create: `app/(supplier)/supplier/impostazioni/sedi/warehouses-client.tsx`
- Create: `components/supplier/warehouses/warehouse-form.tsx`

- [ ] **Step 1: Schema**

```ts
export const WarehouseSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  address: z.string().max(200).nullish(),
  city: z.string().max(80).nullish(),
  province: z.string().max(4).nullish(),
  zip_code: z.string().max(10).nullish(),
  is_primary: z.boolean().default(false),
  is_active: z.boolean().default(true),
});
```

- [ ] **Step 2: Actions**

`createWarehouse`, `updateWarehouse`, `setPrimaryWarehouse` (atomic: azzera il vecchio primary e imposta il nuovo), `archiveWarehouse` (soft via `is_active=false`, rifiuta se è primary). Tutte con `requirePermission(supplierId, 'settings.manage')`.

- [ ] **Step 3: UI**

Tabella con magazzini del supplier, badge "Primary", "Attivo". Form modal per creare/modificare. Conferma obbligatoria per cambio primary.

- [ ] **Manual verification**
  1. Creare magazzino secondario "Deposito Nord".
  2. Impostarlo primary → il vecchio primary perde il flag atomicamente.
  3. Tentare archivio del primary → bloccato.

- [ ] **Step 4: Commit**

```bash
git add lib/supplier/warehouses/ app/\(supplier\)/supplier/impostazioni/sedi/ components/supplier/warehouses/
git commit -m "feat(supplier): gestione sedi (warehouses)"
```

---

## Task 11 — Schemas/actions staff: inviti, revoca, ruoli

**Files:**
- Create: `lib/supplier/staff/schemas.ts`
- Create: `lib/supplier/staff/actions.ts`

- [ ] **Step 1: Schemas**

```ts
export const InviteStaffSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin','sales','warehouse','driver']),
});

export const ChangeRoleSchema = z.object({
  member_id: z.string().uuid(),
  role: z.enum(['admin','sales','warehouse','driver']),
});
```

- [ ] **Step 2: Actions (`"use server"`)**

Tutte gated da `requirePermission(supplierId, 'staff.manage')`.

- `inviteStaff(supplierId, { email, role })`:
  1. Usare Supabase admin client per `auth.admin.inviteUserByEmail(email, { redirectTo: <origin>/supplier/invito/accetta })` OPPURE generare un magic link via `admin.generateLink({ type: 'invite' })` e inviare email custom.
  2. Ottenere/creare `profiles` row (se non esistente) e inserire `supplier_members` con `accepted_at=NULL, is_active=true, role=role, invited_by=auth.uid()`.
  3. Return `{ ok: true, data: member }`.

- `revokeInvite(memberId)` — set `is_active=false` se non accettato; altrimenti usare `removeMember`.

- `removeMember(memberId)` — set `is_active=false`. Rifiutare se è l'ultimo admin attivo.

- `changeRole(input)` — stesso constraint ultimo-admin quando si declassa un admin.

- `acceptInvite(supplierId)` — chiamato dal flow `/supplier/invito/[token]` dopo conferma auth: set `accepted_at=now()`.

- [ ] **Step 3: Commit**

```bash
git add lib/supplier/staff/
git commit -m "feat(staff): schemas e actions inviti/ruoli"
```

---

## Task 12 — UI staff + flow accettazione invito

**Files:**
- Create: `app/(supplier)/supplier/staff/page.tsx`
- Create: `app/(supplier)/supplier/staff/staff-client.tsx`
- Create: `app/(supplier)/supplier/staff/nuovo/page.tsx`
- Create: `app/supplier/invito/[token]/page.tsx`
- Create: `components/supplier/staff/member-row.tsx`
- Create: `components/supplier/staff/invite-form.tsx`

- [ ] **Step 1: Lista staff**

Tabella: Email / Nome (da profiles) / Ruolo (select inline gated su `staff.manage`) / Stato (Invitato/Attivo/Disattivato) / Azioni (Rimuovi, Reinvia invito). Empty state con CTA "Invita membro".

- [ ] **Step 2: Form invito**

`staff/nuovo/page.tsx`: campo email + select ruolo + submit. On success → toast "Invito inviato a ...", redirect a lista.

- [ ] **Step 3: Flow accettazione**

`/supplier/invito/[token]/page.tsx`:
- Il link email apre Supabase Auth magic link → utente loggato.
- Questa route finalizza: chiama `acceptInvite(supplierId)` leggendo `supplierId` dal query param.
- Mostra "Benvenuto in [Supplier Name]. Ora sei [ruolo]." + pulsante "Vai alla dashboard".

- [ ] **Manual verification**
  1. Admin invita `tester@example.com` come `warehouse`. Email arriva (Resend log / Supabase dashboard), link funziona.
  2. Dopo accettazione, `supplier_members.accepted_at` valorizzato, utente loggato vede solo voci consentite.
  3. Admin cambia ruolo a `sales` → UI aggiornata, sidebar ricalcolata al refresh.
  4. Tentare di rimuovere l'unico admin → errore visibile.

- [ ] **Step 4: Commit**

```bash
git add app/\(supplier\)/supplier/staff/ app/supplier/invito/ components/supplier/staff/
git commit -m "feat(staff): UI gestione membri + flow accettazione invito"
```

---

## Task 13 — Abilitare feature flag e verifica finale

**Files:**
- Nessuno di nuovo; solo manual checks + ultima sanity pass.

- [ ] **Step 1: Abilitare la flag per il supplier di test**

```sql
UPDATE suppliers
   SET feature_flags = feature_flags || '{"phase1_enabled": true}'::jsonb
 WHERE id = '<SUPPLIER_TEST_ID>';
```

- [ ] **Step 2: Walkthrough completo**

Come utente admin del supplier pilota:
  1. `/supplier/catalogo` mostra prodotti esistenti.
  2. Apri un prodotto → tab "Unità di vendita" funziona, salva.
  3. `/supplier/listini` mostra "Listino Base" con tutte le righe.
  4. Editor listino: modifica 1 prezzo, verifica anche `products.price` sincronizzato.
  5. `/supplier/impostazioni/sedi` mostra sede primary backfill.
  6. `/supplier/staff` vuoto a parte te stesso (admin). Invita un secondo utente warehouse; accetta invito da altro browser; verifica menu ridotto.
  7. Supplier senza flag → vecchie rotte legacy funzionano come prima, nuove rotte reindirizzano a fallback.

- [ ] **Step 3: Lint + build finale**

```bash
npm run lint
npm run build
```

Nessun errore atteso.

- [ ] **Step 4: Commit finale (se servono piccoli fix)**

```bash
git add -A
git commit -m "chore(supplier): rifiniture fase 1A pre-merge"
```

---

## Note operative

- **DDT/consegne/ordini per-riga/magazzino**: tutto lo schema esiste già dopo 1A ma la UI è in 1B/1C/1D. Gli agenti che implementeranno 1B-1D NON devono toccare lo schema (tranne indici di performance mirati).
- **Viste materializzate** (`mv_supplier_kpi_daily`, `mv_stock_at_risk`): rinviate a 1D (dipendono da dati ordini/lotti reali).
- **Promozioni**: tabella creata, nessuna UI in 1A (rimandata a 1C insieme a workflow ordini).
- **Notifiche**: tabelle create, subscription manager rinviato a 1C.
- **Onboarding wizard 5-step** (§6.4 spec): rinviato a 1D insieme al redesign dashboard.
- **Audit trail server actions**: ogni action che fa mutazione deve emettere in 1C un record `analytics_events` (tabella già esistente). In 1A accettabile solo console.log strutturato via Pino se disponibile.

## Dipendenze per plan successivi

- **1B** (Magazzino) dipende da: Task 1 (`stock_lots`, `stock_movements`, `warehouses`), Task 3 (context + permessi), Task 10 (warehouses UI).
- **1C** (Workflow ordini) dipende da: 1B (lotti per FEFO), Task 1 (`order_split_items`, `order_split_events`, `notification_*`), Task 11/12 (staff multi-utente).
- **1D** (DDT + consegne + KPI) dipende da: 1C (ordini accettati), Task 1 (`deliveries`, `delivery_items`, `ddt_*`).
