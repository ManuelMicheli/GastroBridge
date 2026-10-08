-- Food cost per ricetta (schede tecniche), sempre aggiornato.
-- Spec: docs/superpowers/specs/2026-10-10-fatture-fornitori-food-cost.md
--
-- Purely ADDITIVE (CREATE … IF NOT EXISTS, CREATE OR REPLACE, guarded policies).
-- Access: read analytics.financial, write settings.manage (owner, manager), via
-- private.fin_can() from 20261010010100_supplier_invoices.sql.

CREATE TABLE IF NOT EXISTS public.recipes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id         uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name                  text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  kind                  text NOT NULL DEFAULT 'dish' CHECK (kind IN ('dish', 'base')),
  category              text NULL CHECK (category IS NULL OR char_length(category) <= 60),
  portions              numeric(10,3) NOT NULL DEFAULT 1 CHECK (portions > 0),
  yield_qty             numeric(12,4) NULL CHECK (yield_qty IS NULL OR yield_qty > 0),
  yield_unit            text NULL CHECK (yield_unit IS NULL OR char_length(yield_unit) <= 10),
  sale_price            numeric(10,2) NULL CHECK (sale_price IS NULL OR sale_price >= 0),
  vat_rate              numeric(5,2) NOT NULL DEFAULT 10 CHECK (vat_rate >= 0 AND vat_rate <= 30),
  target_food_cost_pct  numeric(5,2) NOT NULL DEFAULT 30 CHECK (target_food_cost_pct > 0 AND target_food_cost_pct < 100),
  notes                 text NULL CHECK (notes IS NULL OR char_length(notes) <= 2000),
  is_active             boolean NOT NULL DEFAULT true,
  last_cost_per_portion numeric(12,4) NULL,
  last_food_cost_pct    numeric(7,3) NULL,
  last_costed_at        timestamptz NULL,
  created_by            uuid NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recipes_restaurant ON public.recipes (restaurant_id, kind, name);

CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id          uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  restaurant_id      uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  position           integer NOT NULL DEFAULT 0,
  kind               text NOT NULL DEFAULT 'product' CHECK (kind IN ('product', 'sub_recipe', 'manual')),
  -- Price-history key (p:<product> | c:<catalog>:<name> | i:<vat>:<name>).
  price_key          text NULL CHECK (price_key IS NULL OR char_length(price_key) <= 300),
  product_id         uuid NULL REFERENCES public.products(id) ON DELETE SET NULL,
  catalog_id         uuid NULL REFERENCES public.restaurant_catalogs(id) ON DELETE SET NULL,
  sub_recipe_id      uuid NULL REFERENCES public.recipes(id) ON DELETE SET NULL,
  name               text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  quantity           numeric(12,4) NOT NULL CHECK (quantity > 0),
  unit               text NOT NULL CHECK (char_length(unit) BETWEEN 1 AND 10),
  waste_pct          numeric(5,2) NOT NULL DEFAULT 0 CHECK (waste_pct >= 0 AND waste_pct < 95),
  manual_price       numeric(12,4) NULL CHECK (manual_price IS NULL OR manual_price >= 0),
  manual_price_unit  text NULL CHECK (manual_price_unit IS NULL OR char_length(manual_price_unit) <= 10),
  created_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (sub_recipe_id IS NULL OR sub_recipe_id <> recipe_id)
);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON public.recipe_ingredients (recipe_id, position);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_key ON public.recipe_ingredients (restaurant_id, price_key);

CREATE TABLE IF NOT EXISTS public.recipe_cost_snapshots (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id         uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  restaurant_id     uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  cost_per_portion  numeric(12,4) NOT NULL,
  food_cost_pct     numeric(7,3) NULL,
  snapshot          jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recipe_snapshots_recipe ON public.recipe_cost_snapshots (recipe_id, computed_at DESC);

CREATE TABLE IF NOT EXISTS public.food_cost_alerts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id      uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  recipe_id          uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  from_pct           numeric(7,3) NOT NULL,
  to_pct             numeric(7,3) NOT NULL,
  target_pct         numeric(5,2) NOT NULL,
  driver_name        text NULL,
  driver_change_pct  numeric(8,2) NULL,
  message            text NOT NULL CHECK (char_length(message) <= 500),
  created_at         timestamptz NOT NULL DEFAULT now(),
  dismissed_at       timestamptz NULL,
  dismissed_by       uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_food_cost_alerts_open ON public.food_cost_alerts (restaurant_id, created_at DESC) WHERE dismissed_at IS NULL;

-- POS menu item (normalised name) → recipe.
CREATE TABLE IF NOT EXISTS public.recipe_pos_links (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id      uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  pos_name_key       text NOT NULL CHECK (char_length(pos_name_key) BETWEEN 1 AND 200),
  pos_name           text NOT NULL CHECK (char_length(pos_name) BETWEEN 1 AND 200),
  recipe_id          uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  portions_per_sale  numeric(8,3) NOT NULL DEFAULT 1 CHECK (portions_per_sale > 0),
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recipe_pos_links_unique UNIQUE (restaurant_id, pos_name_key)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_recipes_touch') THEN
    CREATE TRIGGER trg_recipes_touch
      BEFORE UPDATE ON public.recipes
      FOR EACH ROW EXECUTE FUNCTION private.fin_touch_updated_at();
  END IF;
END $$;

ALTER TABLE public.recipes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_cost_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_cost_alerts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_pos_links      ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
  direct text[] := ARRAY['recipes', 'food_cost_alerts', 'recipe_pos_links'];
  child  text[] := ARRAY['recipe_ingredients', 'recipe_cost_snapshots'];
BEGIN
  FOREACH t IN ARRAY direct || child LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = t || ' finance read') THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT USING (private.fin_can(restaurant_id, %L))',
        t || ' finance read', t, 'analytics.financial');
    END IF;
  END LOOP;
  FOREACH t IN ARRAY direct LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = t || ' finance write') THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL USING (private.fin_can(restaurant_id, %L)) WITH CHECK (private.fin_can(restaurant_id, %L))',
        t || ' finance write', t, 'settings.manage', 'settings.manage');
    END IF;
  END LOOP;
  FOREACH t IN ARRAY child LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = t || ' finance write') THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL USING (private.fin_can(restaurant_id, %L)) '
        'WITH CHECK (private.fin_can(restaurant_id, %L) AND EXISTS ('
        'SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND r.restaurant_id = %I.restaurant_id))',
        t || ' finance write', t, 'settings.manage', 'settings.manage', t);
    END IF;
  END LOOP;
END $$;

-- Links must point to recipes of the same restaurant.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'recipe_pos_links'
                 AND policyname = 'recipe_pos_links same restaurant') THEN
    CREATE POLICY "recipe_pos_links same restaurant" ON public.recipe_pos_links
      AS RESTRICTIVE FOR ALL
      USING (true)
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND r.restaurant_id = recipe_pos_links.restaurant_id
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'food_cost_alerts'
                 AND policyname = 'food_cost_alerts same restaurant') THEN
    CREATE POLICY "food_cost_alerts same restaurant" ON public.food_cost_alerts
      AS RESTRICTIVE FOR ALL
      USING (true)
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND r.restaurant_id = food_cost_alerts.restaurant_id
      ));
  END IF;
END $$;

-- --------------------------------------------------------------
-- POS sales per item for a period (menu engineering, theoretical food cost).
-- fiscal_receipts is owner-only under RLS; this SECURITY DEFINER function
-- re-checks the caller's permission (analytics.financial) with auth.uid().
-- Amounts: gross (VAT included) and net (ex VAT, by line rate; 10% when the
-- POS does not send a rate).
-- --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.food_cost_pos_sales(_restaurant_id uuid, _from date, _to date)
RETURNS TABLE (name text, qty numeric, gross_cents bigint, net_cents bigint, receipts bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.fin_can(_restaurant_id, 'analytics.financial') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
    SELECT
      min(i.name)::text                                                     AS name,
      sum(i.quantity)::numeric                                              AS qty,
      sum(GREATEST(i.subtotal_cents - i.discount_cents, 0))::bigint         AS gross_cents,
      sum(round(GREATEST(i.subtotal_cents - i.discount_cents, 0)
                / (1 + COALESCE(i.vat_rate, 10) / 100.0)))::bigint          AS net_cents,
      count(DISTINCT r.id)::bigint                                          AS receipts
    FROM public.fiscal_receipt_items i
    JOIN public.fiscal_receipts r ON r.id = i.receipt_id
    WHERE r.restaurant_id = _restaurant_id
      AND r.business_day BETWEEN _from AND _to
      AND r.status IN ('issued', 'partial_refund')
      AND NOT i.is_voided
    GROUP BY lower(btrim(i.name));
END;
$$;
REVOKE ALL ON FUNCTION public.food_cost_pos_sales(uuid, date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.food_cost_pos_sales(uuid, date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.food_cost_pos_sales(uuid, date, date) TO authenticated;
