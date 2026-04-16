-- GastroBridge: auto-provision supplier/restaurant + fix audit trigger RLS.
--
-- Problems addressed:
-- 1. `handle_new_user` creates only `profiles` → new supplier/restaurant
--    accounts have no entity row until one is created manually.
-- 2. Insert on `products` fires `record_initial_price()` trigger which writes
--    to `price_history`. RLS on `price_history` has no INSERT policy and the
--    trigger is not SECURITY DEFINER, so every product INSERT fails.
-- 3. New suppliers miss Fase 1 dependencies (supplier_members admin,
--    warehouse primary, price_lists default, ddt_templates default).

BEGIN;

-- ============================================================
-- 1. Fix price_history audit triggers (make them SECURITY DEFINER).
--    They are system-level and should bypass RLS.
-- ============================================================

CREATE OR REPLACE FUNCTION record_initial_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO price_history (product_id, price)
  VALUES (NEW.id, NEW.price);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION record_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.price IS DISTINCT FROM NEW.price THEN
    INSERT INTO price_history (product_id, price)
    VALUES (NEW.id, NEW.price);
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. Trigger on `suppliers` AFTER INSERT: create Fase 1 deps.
--    Single source of truth for "what a new supplier needs".
-- ============================================================

CREATE OR REPLACE FUNCTION provision_supplier_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin membership for the owner profile.
  INSERT INTO supplier_members (supplier_id, profile_id, role, is_active, accepted_at)
  VALUES (NEW.id, NEW.profile_id, 'admin', true, now())
  ON CONFLICT (supplier_id, profile_id) DO NOTHING;

  -- Primary warehouse.
  INSERT INTO warehouses (supplier_id, name, address, city, province, zip_code, is_primary, is_active)
  SELECT NEW.id, COALESCE(NEW.company_name, 'Sede principale'),
         NEW.address, NEW.city, NEW.province, NEW.zip_code, true, true
  WHERE NOT EXISTS (
    SELECT 1 FROM warehouses w WHERE w.supplier_id = NEW.id AND w.is_primary = true
  );

  -- Default price list.
  INSERT INTO price_lists (supplier_id, name, is_default, is_active)
  SELECT NEW.id, 'Listino Base', true, true
  WHERE NOT EXISTS (
    SELECT 1 FROM price_lists pl WHERE pl.supplier_id = NEW.id AND pl.is_default = true
  );

  -- Default DDT template.
  INSERT INTO ddt_templates (supplier_id, name, logo_url, is_default)
  SELECT NEW.id, 'Template Predefinito', NEW.logo_url, true
  WHERE NOT EXISTS (
    SELECT 1 FROM ddt_templates t WHERE t.supplier_id = NEW.id AND t.is_default = true
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_provision_supplier_defaults ON suppliers;
CREATE TRIGGER trg_provision_supplier_defaults
  AFTER INSERT ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION provision_supplier_defaults();

-- ============================================================
-- 3. Extend `handle_new_user` to also create the entity row
--    (suppliers / restaurants) based on role.
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role          user_role;
  v_company_name  text;
BEGIN
  v_role := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'restaurant');
  v_company_name := COALESCE(NEW.raw_user_meta_data->>'company_name', '');

  INSERT INTO public.profiles (id, role, company_name)
  VALUES (NEW.id, v_role, v_company_name);

  IF v_role = 'supplier' THEN
    INSERT INTO public.suppliers (profile_id, company_name)
    VALUES (
      NEW.id,
      COALESCE(NULLIF(trim(v_company_name), ''), split_part(NEW.email, '@', 1), 'Fornitore')
    );
  ELSIF v_role = 'restaurant' THEN
    INSERT INTO public.restaurants (profile_id, name)
    VALUES (
      NEW.id,
      COALESCE(NULLIF(trim(v_company_name), ''), split_part(NEW.email, '@', 1), 'Ristorante')
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger `on_auth_user_created` already exists and points at handle_new_user.

-- ============================================================
-- 4. Backfill orphan profiles created BEFORE this migration.
-- ============================================================

-- Suppliers missing for supplier-role profiles.
INSERT INTO public.suppliers (profile_id, company_name)
SELECT p.id, COALESCE(NULLIF(trim(p.company_name), ''), 'Fornitore')
  FROM public.profiles p
 WHERE p.role = 'supplier'
   AND NOT EXISTS (SELECT 1 FROM public.suppliers s WHERE s.profile_id = p.id);

-- Restaurants missing for restaurant-role profiles.
INSERT INTO public.restaurants (profile_id, name)
SELECT p.id, COALESCE(NULLIF(trim(p.company_name), ''), 'Ristorante')
  FROM public.profiles p
 WHERE p.role = 'restaurant'
   AND NOT EXISTS (SELECT 1 FROM public.restaurants r WHERE r.profile_id = p.id);

-- Note: the AFTER INSERT trigger on `suppliers` provisions members,
-- warehouses, price_lists, ddt_templates for the backfilled rows.

-- Backfill Fase 1 deps for suppliers that existed BEFORE this migration.
-- (The AFTER INSERT trigger only fires on new rows.)
INSERT INTO supplier_members (supplier_id, profile_id, role, is_active, accepted_at)
SELECT s.id, s.profile_id, 'admin', true, now()
  FROM suppliers s
 WHERE NOT EXISTS (
   SELECT 1 FROM supplier_members sm
    WHERE sm.supplier_id = s.id AND sm.profile_id = s.profile_id
 )
ON CONFLICT (supplier_id, profile_id) DO NOTHING;

INSERT INTO warehouses (supplier_id, name, address, city, province, zip_code, is_primary, is_active)
SELECT s.id, COALESCE(s.company_name, 'Sede principale'),
       s.address, s.city, s.province, s.zip_code, true, true
  FROM suppliers s
 WHERE NOT EXISTS (SELECT 1 FROM warehouses w WHERE w.supplier_id = s.id AND w.is_primary = true);

INSERT INTO price_lists (supplier_id, name, is_default, is_active)
SELECT s.id, 'Listino Base', true, true
  FROM suppliers s
 WHERE NOT EXISTS (SELECT 1 FROM price_lists pl WHERE pl.supplier_id = s.id AND pl.is_default = true);

INSERT INTO ddt_templates (supplier_id, name, logo_url, is_default)
SELECT s.id, 'Template Predefinito', s.logo_url, true
  FROM suppliers s
 WHERE NOT EXISTS (SELECT 1 FROM ddt_templates t WHERE t.supplier_id = s.id AND t.is_default = true);

COMMIT;
