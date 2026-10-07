-- Restaurant superpowers (docs/superpowers/specs/2026-10-08-restaurant-superpowers.md)
--
--   restaurant_supplier_schedules   delivery weekdays + order cut-off per supplier
--                                   (platform supplier or private catalog)
--   restaurant_par_levels           minimum stock per item (Riordino rapido)
--   restaurant_catalog_price_memory last known price per catalog line, kept by a
--   restaurant_catalog_price_changes trigger on restaurant_catalog_items (works
--                                   with delete+insert re-imports: the memory is
--                                   keyed by catalog + normalized name + unit)
--   kitchen_requests                shared kitchen list (chef → who can order)
--   delivery_checks(+_lines)        goods receiving check-in, with photos in the
--                                   private bucket `delivery-checks`
--   restaurant_notification_log     de-duplication of cron reminders / digests
--
-- Purely ADDITIVE: CREATE … IF NOT EXISTS, CREATE OR REPLACE, policies created
-- in DO blocks guarded by pg_policies. No DROP statements.
-- Access: owners (restaurants.profile_id) and active team members through
-- private.is_restaurant_member / private.has_restaurant_permission, with the
-- same permission names as lib/restaurants/permissions.ts.

-- --------------------------------------------------------------
-- 0. Helpers
-- --------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.touch_updated_at() FROM PUBLIC;

-- Owner or active member of the restaurant (any role).
CREATE OR REPLACE FUNCTION private.restaurant_can_read(_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.is_restaurant_owner(_restaurant_id)
      OR private.is_restaurant_member(_restaurant_id);
$$;

-- Owner, or active member whose role grants the permission.
CREATE OR REPLACE FUNCTION private.restaurant_can(_restaurant_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.is_restaurant_owner(_restaurant_id)
      OR private.has_restaurant_permission(_restaurant_id, _permission);
$$;

REVOKE ALL ON FUNCTION private.restaurant_can_read(uuid)   FROM PUBLIC;
REVOKE ALL ON FUNCTION private.restaurant_can(uuid, text)  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.restaurant_can_read(uuid), private.restaurant_can(uuid, text)
  TO authenticated;

-- --------------------------------------------------------------
-- 1. Delivery schedules + cut-offs
-- --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.restaurant_supplier_schedules (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id      uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  supplier_id        uuid NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  catalog_id         uuid NULL REFERENCES public.restaurant_catalogs(id) ON DELETE CASCADE,
  -- 0 = domenica … 6 = sabato (JS getDay(), same as delivery_zones.delivery_days)
  delivery_weekdays  smallint[] NOT NULL DEFAULT '{}'::smallint[]
                     CHECK (delivery_weekdays <@ ARRAY[0,1,2,3,4,5,6]::smallint[]),
  cutoff_time        time NULL,
  -- Days between the order day and the delivery day (1 = "entro le 18 per domani").
  lead_days          smallint NOT NULL DEFAULT 1 CHECK (lead_days BETWEEN 0 AND 14),
  reminder_enabled   boolean NOT NULL DEFAULT true,
  notes              text NULL CHECK (notes IS NULL OR char_length(notes) <= 300),
  updated_by         uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_supplier_schedules_one_target
    CHECK ((supplier_id IS NULL) <> (catalog_id IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_restaurant_supplier_schedules_supplier
  ON public.restaurant_supplier_schedules (restaurant_id, supplier_id)
  WHERE supplier_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_restaurant_supplier_schedules_catalog
  ON public.restaurant_supplier_schedules (restaurant_id, catalog_id)
  WHERE catalog_id IS NOT NULL;

CREATE OR REPLACE TRIGGER trg_restaurant_supplier_schedules_touch
  BEFORE UPDATE ON public.restaurant_supplier_schedules
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

ALTER TABLE public.restaurant_supplier_schedules ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------
-- 2. Par levels
-- --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.restaurant_par_levels (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  -- "p:<product uuid>" (marketplace) or "c:<catalog uuid>:<normalized name>|<unit>"
  item_key       text NOT NULL CHECK (char_length(item_key) BETWEEN 3 AND 400),
  product_name   text NOT NULL CHECK (char_length(product_name) BETWEEN 1 AND 200),
  unit           text NULL CHECK (unit IS NULL OR char_length(unit) <= 30),
  par_qty        numeric(12,3) NOT NULL CHECK (par_qty >= 0),
  updated_by     uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_par_levels_unique UNIQUE (restaurant_id, item_key)
);

CREATE OR REPLACE TRIGGER trg_restaurant_par_levels_touch
  BEFORE UPDATE ON public.restaurant_par_levels
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

ALTER TABLE public.restaurant_par_levels ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------
-- 3. Catalog price memory + change log (trigger, import-agnostic)
-- --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.restaurant_catalog_price_memory (
  catalog_id       uuid NOT NULL REFERENCES public.restaurant_catalogs(id) ON DELETE CASCADE,
  -- "<product_name_normalized>|<lower(trim(unit))>"
  item_key         text NOT NULL,
  product_name     text NOT NULL,
  unit             text NOT NULL,
  last_price       numeric(10,2) NOT NULL,
  previous_price   numeric(10,2) NULL,
  last_changed_at  timestamptz NULL,
  first_seen_at    timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (catalog_id, item_key)
);

CREATE TABLE IF NOT EXISTS public.restaurant_catalog_price_changes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id    uuid NOT NULL REFERENCES public.restaurant_catalogs(id) ON DELETE CASCADE,
  item_key      text NOT NULL,
  product_name  text NOT NULL,
  unit          text NOT NULL,
  old_price     numeric(10,2) NOT NULL,
  new_price     numeric(10,2) NOT NULL,
  changed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restaurant_catalog_price_changes_catalog_changed
  ON public.restaurant_catalog_price_changes (catalog_id, changed_at DESC);

ALTER TABLE public.restaurant_catalog_price_memory  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_catalog_price_changes ENABLE ROW LEVEL SECURITY;

-- Never blocks the catalog write: any failure is downgraded to a WARNING.
-- Several rows with the same key inside ONE transaction (duplicates in a list)
-- do not count as price changes (memory.updated_at = now() = same transaction).
CREATE OR REPLACE FUNCTION private.track_catalog_item_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _key   text;
  _mem   public.restaurant_catalog_price_memory%ROWTYPE;
BEGIN
  BEGIN
    _key := NEW.product_name_normalized || '|' || lower(btrim(NEW.unit));

    SELECT * INTO _mem
    FROM public.restaurant_catalog_price_memory
    WHERE catalog_id = NEW.catalog_id AND item_key = _key
    FOR UPDATE;

    IF NOT FOUND THEN
      INSERT INTO public.restaurant_catalog_price_memory
        (catalog_id, item_key, product_name, unit, last_price)
      VALUES (NEW.catalog_id, _key, NEW.product_name, NEW.unit, NEW.price)
      ON CONFLICT (catalog_id, item_key) DO NOTHING;
    ELSIF _mem.last_price IS DISTINCT FROM NEW.price THEN
      IF _mem.updated_at < now() THEN
        INSERT INTO public.restaurant_catalog_price_changes
          (catalog_id, item_key, product_name, unit, old_price, new_price)
        VALUES (NEW.catalog_id, _key, NEW.product_name, NEW.unit, _mem.last_price, NEW.price);

        UPDATE public.restaurant_catalog_price_memory
           SET previous_price  = _mem.last_price,
               last_price      = NEW.price,
               product_name    = NEW.product_name,
               last_changed_at = now(),
               updated_at      = now()
         WHERE catalog_id = NEW.catalog_id AND item_key = _key;
      END IF;
    ELSE
      UPDATE public.restaurant_catalog_price_memory
         SET product_name = NEW.product_name,
             updated_at   = now()
       WHERE catalog_id = NEW.catalog_id AND item_key = _key;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'track_catalog_item_price: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.track_catalog_item_price() FROM PUBLIC;

CREATE OR REPLACE TRIGGER trg_restaurant_catalog_items_price_memory
  AFTER INSERT OR UPDATE OF price ON public.restaurant_catalog_items
  FOR EACH ROW EXECUTE FUNCTION private.track_catalog_item_price();

-- Backfill the memory with today's prices (first changes appear on the next
-- re-import / edit).
INSERT INTO public.restaurant_catalog_price_memory (catalog_id, item_key, product_name, unit, last_price)
SELECT DISTINCT ON (i.catalog_id, i.product_name_normalized || '|' || lower(btrim(i.unit)))
       i.catalog_id,
       i.product_name_normalized || '|' || lower(btrim(i.unit)),
       i.product_name,
       i.unit,
       i.price
FROM public.restaurant_catalog_items i
ORDER BY i.catalog_id, i.product_name_normalized || '|' || lower(btrim(i.unit)), i.created_at DESC
ON CONFLICT (catalog_id, item_key) DO NOTHING;

-- --------------------------------------------------------------
-- 4. Kitchen list
-- --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.kitchen_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  raw_text       text NOT NULL CHECK (char_length(raw_text) BETWEEN 1 AND 300),
  product_name   text NOT NULL CHECK (char_length(product_name) BETWEEN 1 AND 200),
  quantity       numeric(12,3) NULL CHECK (quantity IS NULL OR quantity > 0),
  unit           text NULL CHECK (unit IS NULL OR char_length(unit) <= 30),
  note           text NULL CHECK (note IS NULL OR char_length(note) <= 300),
  -- Matched catalog offer (cart line snapshot) — optional.
  offer          jsonb NULL,
  status         text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'approved', 'rejected')),
  requested_by   uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  decided_by     uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at     timestamptz NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kitchen_requests_restaurant_status
  ON public.kitchen_requests (restaurant_id, status, created_at DESC);

CREATE OR REPLACE TRIGGER trg_kitchen_requests_touch
  BEFORE UPDATE ON public.kitchen_requests
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

ALTER TABLE public.kitchen_requests ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------
-- 5. Goods receiving check-in
-- --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.delivery_checks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  order_id        uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_split_id  uuid NULL REFERENCES public.order_splits(id) ON DELETE CASCADE,
  supplier_id     uuid NULL REFERENCES public.suppliers(id) ON DELETE SET NULL,
  -- Supplier label for catalog orders (no supplier row).
  supplier_label  text NULL CHECK (supplier_label IS NULL OR char_length(supplier_label) <= 200),
  outcome         text NOT NULL CHECK (outcome IN ('ok', 'issues')),
  issue_count     integer NOT NULL DEFAULT 0 CHECK (issue_count >= 0),
  notes           text NULL CHECK (notes IS NULL OR char_length(notes) <= 1000),
  message_sent    boolean NOT NULL DEFAULT false,
  checked_by      uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  checked_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_checks_order ON public.delivery_checks (order_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_checks_restaurant ON public.delivery_checks (restaurant_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS public.delivery_check_lines (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id      uuid NOT NULL REFERENCES public.delivery_checks(id) ON DELETE CASCADE,
  -- order_items.id for marketplace lines, "catalog:<block>:<line>" otherwise.
  line_ref      text NOT NULL CHECK (char_length(line_ref) <= 120),
  product_name  text NOT NULL CHECK (char_length(product_name) BETWEEN 1 AND 300),
  unit          text NULL CHECK (unit IS NULL OR char_length(unit) <= 30),
  ordered_qty   numeric(12,3) NULL,
  received_qty  numeric(12,3) NULL CHECK (received_qty IS NULL OR received_qty >= 0),
  issue         text NOT NULL DEFAULT 'ok'
                CHECK (issue IN ('ok', 'missing', 'short', 'damaged', 'wrong_item', 'quality')),
  note          text NULL CHECK (note IS NULL OR char_length(note) <= 500),
  photo_paths   text[] NOT NULL DEFAULT '{}'::text[],
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_check_lines_check ON public.delivery_check_lines (check_id);

ALTER TABLE public.delivery_checks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_check_lines ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------
-- 6. Reminder / digest de-duplication (service role only: no policies)
-- --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.restaurant_notification_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  kind           text NOT NULL CHECK (char_length(kind) <= 40),
  ref            text NOT NULL CHECK (char_length(ref) <= 200),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_notification_log_unique UNIQUE (restaurant_id, kind, ref)
);

ALTER TABLE public.restaurant_notification_log ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------
-- 7. Policies (owners + team members)
-- --------------------------------------------------------------

DO $$
BEGIN
  -- restaurant_supplier_schedules: read any member; write order.submit.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'restaurant_supplier_schedules' AND policyname = 'rss team read') THEN
    CREATE POLICY "rss team read" ON public.restaurant_supplier_schedules
      FOR SELECT USING (private.restaurant_can_read(restaurant_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'restaurant_supplier_schedules' AND policyname = 'rss team write') THEN
    CREATE POLICY "rss team write" ON public.restaurant_supplier_schedules
      FOR ALL
      USING (private.restaurant_can(restaurant_id, 'order.submit'))
      WITH CHECK (
        private.restaurant_can(restaurant_id, 'order.submit')
        AND (catalog_id IS NULL OR EXISTS (
          SELECT 1 FROM public.restaurant_catalogs rc
          WHERE rc.id = catalog_id AND rc.restaurant_id = restaurant_supplier_schedules.restaurant_id
        ))
      );
  END IF;

  -- restaurant_par_levels: read any member; write par_levels.manage.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'restaurant_par_levels' AND policyname = 'par team read') THEN
    CREATE POLICY "par team read" ON public.restaurant_par_levels
      FOR SELECT USING (private.restaurant_can_read(restaurant_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'restaurant_par_levels' AND policyname = 'par team manage') THEN
    CREATE POLICY "par team manage" ON public.restaurant_par_levels
      FOR ALL
      USING (private.restaurant_can(restaurant_id, 'par_levels.manage'))
      WITH CHECK (private.restaurant_can(restaurant_id, 'par_levels.manage'));
  END IF;

  -- Catalog price memory / changes: readable by whoever can read the catalog
  -- (the subquery runs under restaurant_catalogs RLS: owner + members).
  -- Writes only through the SECURITY DEFINER trigger.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'restaurant_catalog_price_memory' AND policyname = 'price memory catalog read') THEN
    CREATE POLICY "price memory catalog read" ON public.restaurant_catalog_price_memory
      FOR SELECT USING (catalog_id IN (SELECT rc.id FROM public.restaurant_catalogs rc));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'restaurant_catalog_price_changes' AND policyname = 'price changes catalog read') THEN
    CREATE POLICY "price changes catalog read" ON public.restaurant_catalog_price_changes
      FOR SELECT USING (catalog_id IN (SELECT rc.id FROM public.restaurant_catalogs rc));
  END IF;

  -- kitchen_requests: read any member; add with order.draft (as yourself);
  -- decide with order.submit; delete own open request or with order.submit.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'kitchen_requests' AND policyname = 'kitchen team read') THEN
    CREATE POLICY "kitchen team read" ON public.kitchen_requests
      FOR SELECT USING (private.restaurant_can_read(restaurant_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'kitchen_requests' AND policyname = 'kitchen team add') THEN
    CREATE POLICY "kitchen team add" ON public.kitchen_requests
      FOR INSERT WITH CHECK (
        requested_by = auth.uid()
        AND status = 'open'
        AND private.restaurant_can(restaurant_id, 'order.draft')
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'kitchen_requests' AND policyname = 'kitchen team decide') THEN
    CREATE POLICY "kitchen team decide" ON public.kitchen_requests
      FOR UPDATE
      USING (private.restaurant_can(restaurant_id, 'order.submit'))
      WITH CHECK (private.restaurant_can(restaurant_id, 'order.submit'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'kitchen_requests' AND policyname = 'kitchen team delete') THEN
    CREATE POLICY "kitchen team delete" ON public.kitchen_requests
      FOR DELETE USING (
        (requested_by = auth.uid() AND status = 'open' AND private.restaurant_can_read(restaurant_id))
        OR private.restaurant_can(restaurant_id, 'order.submit')
      );
  END IF;

  -- delivery_checks: read any member; create with order.receive on an order of
  -- the same restaurant.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'delivery_checks' AND policyname = 'delivery checks team read') THEN
    CREATE POLICY "delivery checks team read" ON public.delivery_checks
      FOR SELECT USING (private.restaurant_can_read(restaurant_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'delivery_checks' AND policyname = 'delivery checks team create') THEN
    CREATE POLICY "delivery checks team create" ON public.delivery_checks
      FOR INSERT WITH CHECK (
        checked_by = auth.uid()
        AND private.restaurant_can(restaurant_id, 'order.receive')
        AND EXISTS (SELECT 1 FROM public.orders o
                    WHERE o.id = order_id AND o.restaurant_id = delivery_checks.restaurant_id)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'delivery_checks' AND policyname = 'delivery checks team update') THEN
    CREATE POLICY "delivery checks team update" ON public.delivery_checks
      FOR UPDATE
      USING (private.restaurant_can(restaurant_id, 'order.receive'))
      WITH CHECK (private.restaurant_can(restaurant_id, 'order.receive'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'delivery_check_lines' AND policyname = 'delivery check lines team read') THEN
    CREATE POLICY "delivery check lines team read" ON public.delivery_check_lines
      FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.delivery_checks dc
        WHERE dc.id = check_id AND private.restaurant_can_read(dc.restaurant_id)
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                 AND tablename = 'delivery_check_lines' AND policyname = 'delivery check lines team create') THEN
    CREATE POLICY "delivery check lines team create" ON public.delivery_check_lines
      FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM public.delivery_checks dc
        WHERE dc.id = check_id AND private.restaurant_can(dc.restaurant_id, 'order.receive')
      ));
  END IF;
END $$;

-- --------------------------------------------------------------
-- 8. Private bucket for receiving photos: <restaurant_id>/<check>/<file>
-- --------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('delivery-checks', 'delivery-checks', false, 5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
ON CONFLICT (id) DO NOTHING;

-- First path segment as uuid, NULL when it is not one (never raises).
CREATE OR REPLACE FUNCTION private.storage_path_restaurant(_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  _seg text := split_part(_name, '/', 1);
BEGIN
  IF _seg ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN _seg::uuid;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.storage_path_restaurant(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.storage_path_restaurant(text) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage'
                 AND tablename = 'objects' AND policyname = 'delivery_checks_read_team') THEN
    CREATE POLICY "delivery_checks_read_team" ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'delivery-checks'
        AND private.restaurant_can_read(private.storage_path_restaurant(name))
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage'
                 AND tablename = 'objects' AND policyname = 'delivery_checks_write_receive') THEN
    CREATE POLICY "delivery_checks_write_receive" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'delivery-checks'
        AND private.restaurant_can(private.storage_path_restaurant(name), 'order.receive')
      );
  END IF;
END $$;
