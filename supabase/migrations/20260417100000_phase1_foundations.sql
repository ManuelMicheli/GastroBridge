-- =====================================================================
-- Phase 1A Foundations — Supplier side
-- Enum, table alters, new tables, triggers, helper RPCs,
-- role_permissions seed, backfill, and RLS policies.
--
-- NOTE: ALTER TYPE ... ADD VALUE statements must be auto-committed
-- before being used in DML/DDL. They are therefore placed OUTSIDE the
-- BEGIN/COMMIT block below.
-- =====================================================================

-- --------------------------------------------------------------
-- 1. ENUMS — create new types, extend existing `unit_type`.
--    Existing `unit_type` values (Italian): kg, g, lt, ml, pz,
--    cartone, bottiglia, latta, confezione. We ADD the English
--    values expected by Phase 1 code without removing the old ones.
-- --------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE supplier_role AS ENUM ('admin', 'sales', 'warehouse', 'driver');
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

-- Extend existing unit_type enum (additive, non-destructive).
ALTER TYPE unit_type ADD VALUE IF NOT EXISTS 'piece';
ALTER TYPE unit_type ADD VALUE IF NOT EXISTS 'l';
ALTER TYPE unit_type ADD VALUE IF NOT EXISTS 'box';
ALTER TYPE unit_type ADD VALUE IF NOT EXISTS 'pallet';
ALTER TYPE unit_type ADD VALUE IF NOT EXISTS 'bundle';
ALTER TYPE unit_type ADD VALUE IF NOT EXISTS 'other';

-- --------------------------------------------------------------
-- Main transactional block
-- --------------------------------------------------------------
BEGIN;

-- --------------------------------------------------------------
-- 2. ALTER existing tables
-- --------------------------------------------------------------

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

-- --------------------------------------------------------------
-- 3. New tables (no cross-deps first)
-- --------------------------------------------------------------

-- warehouses
CREATE TABLE IF NOT EXISTS warehouses (
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouses_one_primary
  ON warehouses(supplier_id) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_warehouses_supplier ON warehouses(supplier_id);

-- supplier_members
CREATE TABLE IF NOT EXISTS supplier_members (
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
CREATE INDEX IF NOT EXISTS idx_supplier_members_profile ON supplier_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_supplier_members_supplier ON supplier_members(supplier_id);

-- role_permissions
CREATE TABLE IF NOT EXISTS role_permissions (
  role       supplier_role NOT NULL,
  permission text NOT NULL,
  PRIMARY KEY (role, permission)
);

-- product_sales_units
CREATE TABLE IF NOT EXISTS product_sales_units (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label               text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 60),
  unit_type           unit_type NOT NULL DEFAULT 'pz',
  conversion_to_base  numeric NOT NULL CHECK (conversion_to_base > 0),
  is_base             boolean NOT NULL DEFAULT false,
  barcode             text NULL,
  moq                 numeric NOT NULL DEFAULT 1 CHECK (moq > 0),
  sort_order          int NOT NULL DEFAULT 0,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_psu_one_base
  ON product_sales_units(product_id) WHERE is_base = true;
CREATE INDEX IF NOT EXISTS idx_psu_product ON product_sales_units(product_id);

-- Trigger: enforce exactly 1 base per product
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

DROP TRIGGER IF EXISTS trg_psu_enforce_one_base ON product_sales_units;
CREATE TRIGGER trg_psu_enforce_one_base
  BEFORE INSERT OR UPDATE ON product_sales_units
  FOR EACH ROW EXECUTE FUNCTION trg_psu_enforce_one_base();

-- stock_lots
CREATE TABLE IF NOT EXISTS stock_lots (
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
CREATE INDEX IF NOT EXISTS idx_stock_lots_fefo
  ON stock_lots(product_id, warehouse_id, expiry_date NULLS LAST, received_at);

-- stock_movements
CREATE TABLE IF NOT EXISTS stock_movements (
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
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id, created_at DESC);

-- price_lists
CREATE TABLE IF NOT EXISTS price_lists (
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_lists_one_default
  ON price_lists(supplier_id) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_price_lists_supplier ON price_lists(supplier_id);

-- price_list_items
CREATE TABLE IF NOT EXISTS price_list_items (
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
CREATE TABLE IF NOT EXISTS price_list_tier_discounts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_item_id  uuid NOT NULL REFERENCES price_list_items(id) ON DELETE CASCADE,
  min_quantity        numeric NOT NULL CHECK (min_quantity > 0),
  discount_pct        numeric NOT NULL CHECK (discount_pct >= 0 AND discount_pct <= 100),
  sort_order          int NOT NULL DEFAULT 0,
  UNIQUE (price_list_item_id, min_quantity)
);

-- promotions
CREATE TABLE IF NOT EXISTS promotions (
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
CREATE TABLE IF NOT EXISTS customer_price_assignments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id    uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  restaurant_id  uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  price_list_id  uuid NOT NULL REFERENCES price_lists(id) ON DELETE RESTRICT,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, restaurant_id)
);

-- order_split_items
CREATE TABLE IF NOT EXISTS order_split_items (
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
CREATE INDEX IF NOT EXISTS idx_osi_split ON order_split_items(order_split_id);

-- order_split_events
CREATE TABLE IF NOT EXISTS order_split_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_split_id  uuid NOT NULL REFERENCES order_splits(id) ON DELETE CASCADE,
  event_type      order_split_event_type NOT NULL,
  member_id       uuid NULL REFERENCES supplier_members(id) ON DELETE SET NULL,
  note            text NULL,
  metadata        jsonb NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ose_split ON order_split_events(order_split_id, created_at);

-- deliveries
CREATE TABLE IF NOT EXISTS deliveries (
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
CREATE TABLE IF NOT EXISTS delivery_items (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id             uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  order_split_item_id     uuid NOT NULL REFERENCES order_split_items(id) ON DELETE CASCADE,
  lot_id                  uuid NOT NULL REFERENCES stock_lots(id) ON DELETE RESTRICT,
  quantity_base           numeric NOT NULL,
  quantity_sales_unit     numeric NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- ddt_templates
CREATE TABLE IF NOT EXISTS ddt_templates (
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_ddt_templates_one_default
  ON ddt_templates(supplier_id) WHERE is_default = true;

-- ddt_documents
CREATE TABLE IF NOT EXISTS ddt_documents (
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
CREATE TABLE IF NOT EXISTS notification_preferences (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_member_id  uuid NOT NULL REFERENCES supplier_members(id) ON DELETE CASCADE,
  channel             notification_channel NOT NULL,
  event_type          notification_event NOT NULL,
  enabled             boolean NOT NULL DEFAULT true,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_member_id, channel, event_type)
);

-- push_subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint      text NOT NULL UNIQUE,
  p256dh        text NOT NULL,
  auth          text NOT NULL,
  user_agent    text NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz NULL
);

-- --------------------------------------------------------------
-- 4. Deferred foreign keys (to avoid cycles)
-- --------------------------------------------------------------

DO $$ BEGIN
  ALTER TABLE suppliers
    ADD CONSTRAINT fk_suppliers_default_ddt_template
    FOREIGN KEY (default_ddt_template_id) REFERENCES ddt_templates(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE products
    ADD CONSTRAINT fk_products_default_warehouse
    FOREIGN KEY (default_warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE order_splits
    ADD CONSTRAINT fk_order_splits_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE order_splits
    ADD CONSTRAINT fk_order_splits_sales_member FOREIGN KEY (assigned_sales_member_id) REFERENCES supplier_members(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE order_items
    ADD CONSTRAINT fk_order_items_sales_unit FOREIGN KEY (sales_unit_id) REFERENCES product_sales_units(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE delivery_zones
    ADD CONSTRAINT fk_delivery_zones_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE stock_movements
    ADD CONSTRAINT fk_sm_split FOREIGN KEY (ref_order_split_id) REFERENCES order_splits(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE stock_movements
    ADD CONSTRAINT fk_sm_delivery_item FOREIGN KEY (ref_delivery_item_id) REFERENCES delivery_items(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- --------------------------------------------------------------
-- 5. Seed role_permissions
-- --------------------------------------------------------------

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
]) AS p
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role, permission)
SELECT 'sales'::supplier_role, p FROM unnest(ARRAY[
  'order.read','order.accept_line',
  'catalog.read','catalog.edit',
  'pricing.read','pricing.edit',
  'delivery.plan',
  'analytics.financial','reviews.reply'
]) AS p
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role, permission)
SELECT 'warehouse'::supplier_role, p FROM unnest(ARRAY[
  'order.read','order.prepare',
  'catalog.read',
  'stock.read','stock.receive','stock.adjust',
  'ddt.generate',
  'delivery.execute'
]) AS p
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role, permission)
SELECT 'driver'::supplier_role, p FROM unnest(ARRAY[
  'order.read',
  'delivery.execute'
]) AS p
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------
-- 6. Helper RPCs (SECURITY DEFINER)
-- --------------------------------------------------------------

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

-- --------------------------------------------------------------
-- 7. Backfill
-- NOTE: The existing unit_type enum uses Italian labels. The
-- new 'piece' value was added above but cannot be used in the
-- same transaction (Postgres restriction), so the backfill for
-- product_sales_units uses 'pz' (the existing Italian base unit).
-- --------------------------------------------------------------

-- 1 warehouse primary per supplier
INSERT INTO warehouses (supplier_id, name, address, city, province, zip_code, is_primary, is_active)
SELECT s.id, COALESCE(s.company_name, 'Sede principale'),
       s.address, s.city, s.province, s.zip_code, true, true
  FROM suppliers s
 WHERE NOT EXISTS (SELECT 1 FROM warehouses w WHERE w.supplier_id = s.id);

-- supplier_members: admin from the owner profile
INSERT INTO supplier_members (supplier_id, profile_id, role, is_active, accepted_at)
SELECT s.id, s.profile_id, 'admin', true, now()
  FROM suppliers s
 WHERE s.profile_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM supplier_members sm
      WHERE sm.supplier_id = s.id AND sm.profile_id = s.profile_id
   );

-- product_sales_units: one base row per product
INSERT INTO product_sales_units (product_id, label, unit_type, conversion_to_base, is_base, moq)
SELECT p.id,
       COALESCE(p.unit::text, 'pezzo'),
       'pz'::unit_type,
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

-- price_list_items: base row for each product on the default list
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

-- products.default_warehouse_id = primary warehouse
UPDATE products p
   SET default_warehouse_id = w.id
  FROM warehouses w
 WHERE w.supplier_id = p.supplier_id
   AND w.is_primary = true
   AND p.default_warehouse_id IS NULL;

-- customer_price_assignments: each restaurant with order history → default list
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

-- --------------------------------------------------------------
-- 8. Enable RLS on new tables
-- --------------------------------------------------------------

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

-- --------------------------------------------------------------
-- 9. RLS policies
-- --------------------------------------------------------------

-- role_permissions: read-all for authenticated
DROP POLICY IF EXISTS "role_permissions read all authenticated" ON role_permissions;
CREATE POLICY "role_permissions read all authenticated"
  ON role_permissions FOR SELECT TO authenticated USING (true);

-- warehouses
DROP POLICY IF EXISTS "warehouses member read" ON warehouses;
CREATE POLICY "warehouses member read"
  ON warehouses FOR SELECT
  USING (is_supplier_member(supplier_id));
DROP POLICY IF EXISTS "warehouses admin manage" ON warehouses;
CREATE POLICY "warehouses admin manage"
  ON warehouses FOR ALL
  USING (has_supplier_permission(supplier_id, 'settings.manage'))
  WITH CHECK (has_supplier_permission(supplier_id, 'settings.manage'));

-- supplier_members
DROP POLICY IF EXISTS "supplier_members self read" ON supplier_members;
CREATE POLICY "supplier_members self read"
  ON supplier_members FOR SELECT
  USING (profile_id = auth.uid() OR is_supplier_member(supplier_id));
DROP POLICY IF EXISTS "supplier_members admin manage" ON supplier_members;
CREATE POLICY "supplier_members admin manage"
  ON supplier_members FOR ALL
  USING (has_supplier_permission(supplier_id, 'staff.manage'))
  WITH CHECK (has_supplier_permission(supplier_id, 'staff.manage'));

-- product_sales_units
DROP POLICY IF EXISTS "psu member read" ON product_sales_units;
CREATE POLICY "psu member read"
  ON product_sales_units FOR SELECT
  USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_sales_units.product_id AND is_supplier_member(p.supplier_id)));
DROP POLICY IF EXISTS "psu catalog edit" ON product_sales_units;
CREATE POLICY "psu catalog edit"
  ON product_sales_units FOR ALL
  USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_sales_units.product_id AND has_supplier_permission(p.supplier_id, 'catalog.edit')))
  WITH CHECK (EXISTS (SELECT 1 FROM products p WHERE p.id = product_sales_units.product_id AND has_supplier_permission(p.supplier_id, 'catalog.edit')));

-- price_lists & items
DROP POLICY IF EXISTS "price_lists member read" ON price_lists;
CREATE POLICY "price_lists member read"
  ON price_lists FOR SELECT USING (is_supplier_member(supplier_id));
DROP POLICY IF EXISTS "price_lists pricing edit" ON price_lists;
CREATE POLICY "price_lists pricing edit"
  ON price_lists FOR ALL
  USING (has_supplier_permission(supplier_id, 'pricing.edit'))
  WITH CHECK (has_supplier_permission(supplier_id, 'pricing.edit'));

DROP POLICY IF EXISTS "price_list_items member read" ON price_list_items;
CREATE POLICY "price_list_items member read"
  ON price_list_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM price_lists pl WHERE pl.id = price_list_id AND is_supplier_member(pl.supplier_id)));
DROP POLICY IF EXISTS "price_list_items pricing edit" ON price_list_items;
CREATE POLICY "price_list_items pricing edit"
  ON price_list_items FOR ALL
  USING (EXISTS (SELECT 1 FROM price_lists pl WHERE pl.id = price_list_id AND has_supplier_permission(pl.supplier_id, 'pricing.edit')))
  WITH CHECK (EXISTS (SELECT 1 FROM price_lists pl WHERE pl.id = price_list_id AND has_supplier_permission(pl.supplier_id, 'pricing.edit')));

-- price_list_tier_discounts
DROP POLICY IF EXISTS "pltd pricing manage" ON price_list_tier_discounts;
CREATE POLICY "pltd pricing manage"
  ON price_list_tier_discounts FOR ALL
  USING (EXISTS (SELECT 1 FROM price_list_items pli JOIN price_lists pl ON pl.id = pli.price_list_id WHERE pli.id = price_list_item_id AND has_supplier_permission(pl.supplier_id, 'pricing.edit')))
  WITH CHECK (EXISTS (SELECT 1 FROM price_list_items pli JOIN price_lists pl ON pl.id = pli.price_list_id WHERE pli.id = price_list_item_id AND has_supplier_permission(pl.supplier_id, 'pricing.edit')));

-- stock_lots / stock_movements
DROP POLICY IF EXISTS "stock_lots member read" ON stock_lots;
CREATE POLICY "stock_lots member read"
  ON stock_lots FOR SELECT
  USING (EXISTS (SELECT 1 FROM warehouses w WHERE w.id = warehouse_id AND is_supplier_member(w.supplier_id)));
DROP POLICY IF EXISTS "stock_lots manage" ON stock_lots;
CREATE POLICY "stock_lots manage"
  ON stock_lots FOR ALL
  USING (EXISTS (SELECT 1 FROM warehouses w WHERE w.id = warehouse_id AND (has_supplier_permission(w.supplier_id,'stock.receive') OR has_supplier_permission(w.supplier_id,'stock.adjust'))))
  WITH CHECK (EXISTS (SELECT 1 FROM warehouses w WHERE w.id = warehouse_id AND (has_supplier_permission(w.supplier_id,'stock.receive') OR has_supplier_permission(w.supplier_id,'stock.adjust'))));

DROP POLICY IF EXISTS "stock_movements member read" ON stock_movements;
CREATE POLICY "stock_movements member read"
  ON stock_movements FOR SELECT
  USING (EXISTS (SELECT 1 FROM warehouses w WHERE w.id = warehouse_id AND is_supplier_member(w.supplier_id)));
DROP POLICY IF EXISTS "stock_movements insert" ON stock_movements;
CREATE POLICY "stock_movements insert"
  ON stock_movements FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM warehouses w WHERE w.id = warehouse_id AND (has_supplier_permission(w.supplier_id,'stock.receive') OR has_supplier_permission(w.supplier_id,'stock.adjust'))));

-- promotions
DROP POLICY IF EXISTS "promotions pricing manage" ON promotions;
CREATE POLICY "promotions pricing manage"
  ON promotions FOR ALL
  USING (has_supplier_permission(supplier_id,'pricing.edit'))
  WITH CHECK (has_supplier_permission(supplier_id,'pricing.edit'));
DROP POLICY IF EXISTS "promotions public read active" ON promotions;
CREATE POLICY "promotions public read active"
  ON promotions FOR SELECT TO authenticated
  USING (is_active = true AND now() BETWEEN starts_at AND ends_at);

-- customer_price_assignments
DROP POLICY IF EXISTS "cpa supplier manage" ON customer_price_assignments;
CREATE POLICY "cpa supplier manage"
  ON customer_price_assignments FOR ALL
  USING (has_supplier_permission(supplier_id,'pricing.edit'))
  WITH CHECK (has_supplier_permission(supplier_id,'pricing.edit'));
DROP POLICY IF EXISTS "cpa restaurant read own" ON customer_price_assignments;
CREATE POLICY "cpa restaurant read own"
  ON customer_price_assignments FOR SELECT
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE profile_id = auth.uid()));

-- order_split_items / events
DROP POLICY IF EXISTS "osi member read" ON order_split_items;
CREATE POLICY "osi member read"
  ON order_split_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM order_splits os WHERE os.id = order_split_id AND is_supplier_member(os.supplier_id)));
DROP POLICY IF EXISTS "osi accept update" ON order_split_items;
CREATE POLICY "osi accept update"
  ON order_split_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM order_splits os WHERE os.id = order_split_id AND has_supplier_permission(os.supplier_id,'order.accept_line')))
  WITH CHECK (EXISTS (SELECT 1 FROM order_splits os WHERE os.id = order_split_id AND has_supplier_permission(os.supplier_id,'order.accept_line')));
DROP POLICY IF EXISTS "osi insert" ON order_split_items;
CREATE POLICY "osi insert"
  ON order_split_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM order_splits os WHERE os.id = order_split_id AND is_supplier_member(os.supplier_id)));

DROP POLICY IF EXISTS "ose member read" ON order_split_events;
CREATE POLICY "ose member read"
  ON order_split_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM order_splits os WHERE os.id = order_split_id AND is_supplier_member(os.supplier_id)));
DROP POLICY IF EXISTS "ose insert" ON order_split_events;
CREATE POLICY "ose insert"
  ON order_split_events FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM order_splits os WHERE os.id = order_split_id AND is_supplier_member(os.supplier_id)));

-- deliveries / delivery_items
DROP POLICY IF EXISTS "deliveries member read" ON deliveries;
CREATE POLICY "deliveries member read"
  ON deliveries FOR SELECT
  USING (EXISTS (SELECT 1 FROM warehouses w WHERE w.id = warehouse_id AND is_supplier_member(w.supplier_id)));
DROP POLICY IF EXISTS "deliveries plan" ON deliveries;
CREATE POLICY "deliveries plan"
  ON deliveries FOR ALL
  USING (EXISTS (SELECT 1 FROM warehouses w WHERE w.id = warehouse_id AND (has_supplier_permission(w.supplier_id,'delivery.plan') OR has_supplier_permission(w.supplier_id,'delivery.execute'))))
  WITH CHECK (EXISTS (SELECT 1 FROM warehouses w WHERE w.id = warehouse_id AND (has_supplier_permission(w.supplier_id,'delivery.plan') OR has_supplier_permission(w.supplier_id,'delivery.execute'))));

DROP POLICY IF EXISTS "delivery_items member read" ON delivery_items;
CREATE POLICY "delivery_items member read"
  ON delivery_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM deliveries d JOIN warehouses w ON w.id = d.warehouse_id WHERE d.id = delivery_id AND is_supplier_member(w.supplier_id)));
DROP POLICY IF EXISTS "delivery_items insert" ON delivery_items;
CREATE POLICY "delivery_items insert"
  ON delivery_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM deliveries d JOIN warehouses w ON w.id = d.warehouse_id WHERE d.id = delivery_id AND has_supplier_permission(w.supplier_id,'delivery.execute')));

-- ddt_templates / ddt_documents (ddt immutable: only INSERT + SELECT)
DROP POLICY IF EXISTS "ddt_templates manage" ON ddt_templates;
CREATE POLICY "ddt_templates manage"
  ON ddt_templates FOR ALL
  USING (has_supplier_permission(supplier_id,'ddt.manage_templates'))
  WITH CHECK (has_supplier_permission(supplier_id,'ddt.manage_templates'));
DROP POLICY IF EXISTS "ddt_templates member read" ON ddt_templates;
CREATE POLICY "ddt_templates member read"
  ON ddt_templates FOR SELECT USING (is_supplier_member(supplier_id));

DROP POLICY IF EXISTS "ddt_documents member read" ON ddt_documents;
CREATE POLICY "ddt_documents member read"
  ON ddt_documents FOR SELECT USING (is_supplier_member(supplier_id));
DROP POLICY IF EXISTS "ddt_documents insert" ON ddt_documents;
CREATE POLICY "ddt_documents insert"
  ON ddt_documents FOR INSERT
  WITH CHECK (has_supplier_permission(supplier_id,'ddt.generate'));

-- notification_preferences
DROP POLICY IF EXISTS "np self manage" ON notification_preferences;
CREATE POLICY "np self manage"
  ON notification_preferences FOR ALL
  USING (EXISTS (SELECT 1 FROM supplier_members sm WHERE sm.id = supplier_member_id AND sm.profile_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM supplier_members sm WHERE sm.id = supplier_member_id AND sm.profile_id = auth.uid()));

-- push_subscriptions
DROP POLICY IF EXISTS "push_subs self manage" ON push_subscriptions;
CREATE POLICY "push_subs self manage"
  ON push_subscriptions FOR ALL
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

COMMIT;
