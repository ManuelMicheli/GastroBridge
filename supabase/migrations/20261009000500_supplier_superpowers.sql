-- Supplier superpowers (spec: docs/superpowers/specs/2026-10-08-supplier-superpowers.md)
--
-- Purely ADDITIVE:
--   1. deliveries.route_position         — saved stop order of the "Giro consegne"
--   2. supplier_customer_terms           — credit control (fido, termini, blocco)
--   3. scheduled_price_changes           — price list changes with an effective date
--   4. notification_event new values     — restaurant-facing notifications
--
-- No DROP statements: policies are created only when missing (pg_policies),
-- tables/columns/indexes with IF NOT EXISTS. RLS uses the same helpers as the
-- rest of the supplier area (is_supplier_member / has_supplier_permission).
-- The app degrades gracefully while this migration is not applied.

-- --------------------------------------------------------------
-- 1. deliveries.route_position
-- --------------------------------------------------------------
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS route_position integer NULL;

COMMENT ON COLUMN public.deliveries.route_position IS
  'Stop order within the driver''s route for scheduled_date (1 = first). NULL = not planned yet.';

CREATE INDEX IF NOT EXISTS idx_deliveries_date_route
  ON public.deliveries (scheduled_date, route_position);

-- --------------------------------------------------------------
-- 2. supplier_customer_terms
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplier_customer_terms (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id           uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  restaurant_id         uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  credit_limit_eur      numeric NULL CHECK (credit_limit_eur IS NULL OR credit_limit_eur >= 0),
  payment_terms_days    integer NULL CHECK (payment_terms_days IS NULL OR payment_terms_days BETWEEN 0 AND 365),
  credit_hold           boolean NOT NULL DEFAULT false,
  notes                 text NULL CHECK (notes IS NULL OR char_length(notes) <= 500),
  updated_by_member_id  uuid NULL REFERENCES public.supplier_members(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_customer_terms_supplier
  ON public.supplier_customer_terms (supplier_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_supplier_customer_terms_updated_at'
  ) THEN
    CREATE TRIGGER set_supplier_customer_terms_updated_at
      BEFORE UPDATE ON public.supplier_customer_terms
      FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
  END IF;
END $$;

ALTER TABLE public.supplier_customer_terms ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supplier_customer_terms'
      AND policyname = 'supplier_customer_terms member read'
  ) THEN
    CREATE POLICY "supplier_customer_terms member read"
      ON public.supplier_customer_terms FOR SELECT
      USING (is_supplier_member(supplier_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supplier_customer_terms'
      AND policyname = 'supplier_customer_terms pricing insert'
  ) THEN
    CREATE POLICY "supplier_customer_terms pricing insert"
      ON public.supplier_customer_terms FOR INSERT
      WITH CHECK (has_supplier_permission(supplier_id, 'pricing.edit'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supplier_customer_terms'
      AND policyname = 'supplier_customer_terms pricing update'
  ) THEN
    CREATE POLICY "supplier_customer_terms pricing update"
      ON public.supplier_customer_terms FOR UPDATE
      USING (has_supplier_permission(supplier_id, 'pricing.edit'))
      WITH CHECK (has_supplier_permission(supplier_id, 'pricing.edit'));
  END IF;
END $$;

-- --------------------------------------------------------------
-- 3. scheduled_price_changes
-- --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scheduled_price_changes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id           uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  price_list_id         uuid NOT NULL REFERENCES public.price_lists(id) ON DELETE CASCADE,
  category_id           uuid NULL REFERENCES public.categories(id) ON DELETE SET NULL,
  mode                  text NOT NULL CHECK (mode IN ('percent', 'fixed')),
  value                 numeric NOT NULL CHECK (value BETWEEN -1000 AND 1000),
  effective_date        date NOT NULL,
  status                text NOT NULL DEFAULT 'scheduled'
                          CHECK (status IN ('scheduled', 'applied', 'canceled')),
  note                  text NULL CHECK (note IS NULL OR char_length(note) <= 300),
  notify_clients        boolean NOT NULL DEFAULT true,
  notified_at           timestamptz NULL,
  applied_at            timestamptz NULL,
  applied_count         integer NULL,
  created_by_member_id  uuid NULL REFERENCES public.supplier_members(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_price_changes_due
  ON public.scheduled_price_changes (status, effective_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_price_changes_list
  ON public.scheduled_price_changes (price_list_id, effective_date);

ALTER TABLE public.scheduled_price_changes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scheduled_price_changes'
      AND policyname = 'scheduled_price_changes pricing read'
  ) THEN
    CREATE POLICY "scheduled_price_changes pricing read"
      ON public.scheduled_price_changes FOR SELECT
      USING (has_supplier_permission(supplier_id, 'pricing.read'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scheduled_price_changes'
      AND policyname = 'scheduled_price_changes pricing insert'
  ) THEN
    CREATE POLICY "scheduled_price_changes pricing insert"
      ON public.scheduled_price_changes FOR INSERT
      WITH CHECK (has_supplier_permission(supplier_id, 'pricing.edit'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scheduled_price_changes'
      AND policyname = 'scheduled_price_changes pricing update'
  ) THEN
    CREATE POLICY "scheduled_price_changes pricing update"
      ON public.scheduled_price_changes FOR UPDATE
      USING (has_supplier_permission(supplier_id, 'pricing.edit'))
      WITH CHECK (has_supplier_permission(supplier_id, 'pricing.edit'));
  END IF;
END $$;

-- --------------------------------------------------------------
-- 4. notification_event — restaurant-facing events
--    (ADD VALUE IF NOT EXISTS is additive and idempotent)
-- --------------------------------------------------------------
ALTER TYPE notification_event ADD VALUE IF NOT EXISTS 'price_change_scheduled';
ALTER TYPE notification_event ADD VALUE IF NOT EXISTS 'delivery_eta';
ALTER TYPE notification_event ADD VALUE IF NOT EXISTS 'order_created_by_supplier';
