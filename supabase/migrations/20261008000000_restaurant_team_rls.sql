-- Restaurant team access (Impostazioni → Team).
--
-- `restaurant_members` + `role_permissions_restaurant` and the helpers
-- private.is_restaurant_member / has_restaurant_permission /
-- restaurant_member_role exist since restaurant phase 1A, but every original
-- RLS policy on the restaurant tables only matches the OWNER
-- (`restaurants.profile_id = auth.uid()`). Invited members (manager / chef /
-- viewer) therefore saw empty pages and could not order, although the app now
-- resolves the restaurant through lib/restaurants/context.ts.
--
-- This migration is purely ADDITIVE (policies are OR-ed; no owner policy is
-- dropped). Member policies are gated with the same permission matrix as the
-- app (role_permissions_restaurant / lib/restaurants/permissions.ts):
--   read                         → any active, accepted member
--   orders / items / splits      → order.submit (create), order.submit|order.receive (update)
--   suppliers, catalogs, chat    → partnership.manage (chat also order.submit)
--   saved orders (templates)     → template.manage
--   preferences, budget          → settings.manage
--   reviews                      → rating.submit
--
-- It also gives every restaurant an owner membership (backfill + trigger), so
-- has_restaurant_permission() is true for owners of restaurants created after
-- the phase-1A backfill, and guards restaurants.profile_id / is_primary
-- against changes by non-owners (members with settings.manage may update the
-- restaurant row).
--
-- Helpers that traverse RLS-protected tables are SECURITY DEFINER in the
-- `private` schema (not exposed by PostgREST), like the existing ones, and use
-- auth.uid() internally (no user id argument → no enumeration oracle).

-- --------------------------------------------------------------
-- 1. Helpers
-- --------------------------------------------------------------

-- Active, accepted membership of auth.uid() on the restaurant that owns the
-- row, optionally with a permission. NULL permission = membership only.
CREATE OR REPLACE FUNCTION private.restaurant_member_has(_restaurant_id uuid, _permission text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM restaurant_members rm
    WHERE rm.restaurant_id = _restaurant_id
      AND rm.profile_id    = auth.uid()
      AND rm.is_active
      AND rm.accepted_at IS NOT NULL
      AND (
        _permission IS NULL
        OR EXISTS (
          SELECT 1 FROM role_permissions_restaurant rp
          WHERE rp.role = rm.role AND rp.permission = _permission
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.restaurant_member_order_access(_order_id uuid, _permission text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = _order_id
      AND private.restaurant_member_has(o.restaurant_id, _permission)
  );
$$;

CREATE OR REPLACE FUNCTION private.restaurant_member_split_access(_split_id uuid, _permission text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM order_splits os
    JOIN orders o ON o.id = os.order_id
    WHERE os.id = _split_id
      AND private.restaurant_member_has(o.restaurant_id, _permission)
  );
$$;

CREATE OR REPLACE FUNCTION private.restaurant_member_relationship_access(_relationship_id uuid, _permission text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM restaurant_suppliers rs
    WHERE rs.id = _relationship_id
      AND private.restaurant_member_has(rs.restaurant_id, _permission)
  );
$$;

CREATE OR REPLACE FUNCTION private.restaurant_member_catalog_access(_catalog_id uuid, _permission text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM restaurant_catalogs rc
    WHERE rc.id = _catalog_id
      AND private.restaurant_member_has(rc.restaurant_id, _permission)
  );
$$;

REVOKE ALL ON FUNCTION private.restaurant_member_has(uuid, text)                 FROM PUBLIC;
REVOKE ALL ON FUNCTION private.restaurant_member_order_access(uuid, text)        FROM PUBLIC;
REVOKE ALL ON FUNCTION private.restaurant_member_split_access(uuid, text)        FROM PUBLIC;
REVOKE ALL ON FUNCTION private.restaurant_member_relationship_access(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.restaurant_member_catalog_access(uuid, text)      FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.restaurant_member_has(uuid, text),
                         private.restaurant_member_order_access(uuid, text),
                         private.restaurant_member_split_access(uuid, text),
                         private.restaurant_member_relationship_access(uuid, text),
                         private.restaurant_member_catalog_access(uuid, text)
  TO authenticated;

-- --------------------------------------------------------------
-- 2. Owner membership for every restaurant (backfill + trigger).
-- --------------------------------------------------------------
INSERT INTO restaurant_members (restaurant_id, profile_id, role, is_active, invited_by, accepted_at)
SELECT r.id, r.profile_id, 'owner'::restaurant_role, true, r.profile_id, now()
FROM restaurants r
WHERE r.profile_id IS NOT NULL
ON CONFLICT (restaurant_id, profile_id) DO NOTHING;

CREATE OR REPLACE FUNCTION private.provision_restaurant_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.profile_id IS NOT NULL THEN
    INSERT INTO restaurant_members (restaurant_id, profile_id, role, is_active, invited_by, accepted_at)
    VALUES (NEW.id, NEW.profile_id, 'owner', true, NEW.profile_id, now())
    ON CONFLICT (restaurant_id, profile_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.provision_restaurant_owner_membership() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_provision_restaurant_owner_membership ON restaurants;
CREATE TRIGGER trg_provision_restaurant_owner_membership
  AFTER INSERT ON restaurants
  FOR EACH ROW
  EXECUTE FUNCTION private.provision_restaurant_owner_membership();

-- Members with settings.manage may update the restaurant row, but never move
-- its ownership nor the owner's primary location.
CREATE OR REPLACE FUNCTION private.guard_restaurant_owner_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND auth.uid() IS DISTINCT FROM OLD.profile_id
     AND (NEW.profile_id IS DISTINCT FROM OLD.profile_id
          OR NEW.is_primary IS DISTINCT FROM OLD.is_primary) THEN
    RAISE EXCEPTION 'Only the restaurant owner can change profile_id or is_primary'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_restaurant_owner_columns() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_guard_restaurant_owner_columns ON restaurants;
CREATE TRIGGER trg_guard_restaurant_owner_columns
  BEFORE UPDATE ON restaurants
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_restaurant_owner_columns();

-- --------------------------------------------------------------
-- 3. restaurants — members read; settings.manage updates.
-- --------------------------------------------------------------
DROP POLICY IF EXISTS "restaurants team member read" ON restaurants;
CREATE POLICY "restaurants team member read"
  ON restaurants FOR SELECT
  USING (private.is_restaurant_member(id));

DROP POLICY IF EXISTS "restaurants team settings update" ON restaurants;
CREATE POLICY "restaurants team settings update"
  ON restaurants FOR UPDATE
  USING (private.has_restaurant_permission(id, 'settings.manage'))
  WITH CHECK (private.has_restaurant_permission(id, 'settings.manage'));

-- --------------------------------------------------------------
-- 4. Orders — members read; order.submit creates; submit/receive update.
--    create_order_with_splits() is SECURITY INVOKER, so these are what let
--    a chef/manager place an order.
-- --------------------------------------------------------------
DROP POLICY IF EXISTS "orders team member read" ON orders;
CREATE POLICY "orders team member read"
  ON orders FOR SELECT
  USING (private.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "orders team member create" ON orders;
CREATE POLICY "orders team member create"
  ON orders FOR INSERT
  WITH CHECK (private.has_restaurant_permission(restaurant_id, 'order.submit'));

DROP POLICY IF EXISTS "orders team member update" ON orders;
CREATE POLICY "orders team member update"
  ON orders FOR UPDATE
  USING (
    private.has_restaurant_permission(restaurant_id, 'order.submit')
    OR private.has_restaurant_permission(restaurant_id, 'order.receive')
  )
  WITH CHECK (
    private.has_restaurant_permission(restaurant_id, 'order.submit')
    OR private.has_restaurant_permission(restaurant_id, 'order.receive')
  );

DROP POLICY IF EXISTS "order_items team member read" ON order_items;
CREATE POLICY "order_items team member read"
  ON order_items FOR SELECT
  USING (private.restaurant_member_order_access(order_id));

DROP POLICY IF EXISTS "order_items team member create" ON order_items;
CREATE POLICY "order_items team member create"
  ON order_items FOR INSERT
  WITH CHECK (private.restaurant_member_order_access(order_id, 'order.submit'));

DROP POLICY IF EXISTS "order_splits team member read" ON order_splits;
CREATE POLICY "order_splits team member read"
  ON order_splits FOR SELECT
  USING (private.restaurant_member_order_access(order_id));

DROP POLICY IF EXISTS "order_splits team member create" ON order_splits;
CREATE POLICY "order_splits team member create"
  ON order_splits FOR INSERT
  WITH CHECK (private.restaurant_member_order_access(order_id, 'order.submit'));

DROP POLICY IF EXISTS "osi team member read" ON order_split_items;
CREATE POLICY "osi team member read"
  ON order_split_items FOR SELECT
  USING (private.restaurant_member_split_access(order_split_id));

DROP POLICY IF EXISTS "osi team member create" ON order_split_items;
CREATE POLICY "osi team member create"
  ON order_split_items FOR INSERT
  WITH CHECK (private.restaurant_member_split_access(order_split_id, 'order.submit'));

DROP POLICY IF EXISTS "ose team member create" ON order_split_events;
CREATE POLICY "ose team member create"
  ON order_split_events FOR INSERT
  WITH CHECK (
    private.restaurant_member_split_access(order_split_id, 'order.submit')
    OR private.restaurant_member_split_access(order_split_id, 'order.receive')
  );

-- --------------------------------------------------------------
-- 5. Supplier relationships, price lists and chat.
-- --------------------------------------------------------------
DROP POLICY IF EXISTS "restaurant_suppliers team member read" ON restaurant_suppliers;
CREATE POLICY "restaurant_suppliers team member read"
  ON restaurant_suppliers FOR SELECT
  USING (private.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "restaurant_suppliers team member invite" ON restaurant_suppliers;
CREATE POLICY "restaurant_suppliers team member invite"
  ON restaurant_suppliers FOR INSERT
  WITH CHECK (
    private.has_restaurant_permission(restaurant_id, 'partnership.manage')
    AND invited_by = auth.uid()
    AND status = 'pending'
  );

DROP POLICY IF EXISTS "restaurant_suppliers team member update" ON restaurant_suppliers;
CREATE POLICY "restaurant_suppliers team member update"
  ON restaurant_suppliers FOR UPDATE
  USING (private.has_restaurant_permission(restaurant_id, 'partnership.manage'))
  WITH CHECK (private.has_restaurant_permission(restaurant_id, 'partnership.manage'));

DROP POLICY IF EXISTS "restaurant_suppliers team member delete" ON restaurant_suppliers;
CREATE POLICY "restaurant_suppliers team member delete"
  ON restaurant_suppliers FOR DELETE
  USING (private.has_restaurant_permission(restaurant_id, 'partnership.manage'));

DROP POLICY IF EXISTS "supplier_price_lists team member read" ON supplier_price_lists;
CREATE POLICY "supplier_price_lists team member read"
  ON supplier_price_lists FOR SELECT
  USING (
    private.restaurant_member_relationship_access(relationship_id)
    AND EXISTS (
      SELECT 1 FROM restaurant_suppliers rs
      WHERE rs.id = relationship_id AND rs.status = 'active'
    )
  );

DROP POLICY IF EXISTS "cpa team member read" ON customer_price_assignments;
CREATE POLICY "cpa team member read"
  ON customer_price_assignments FOR SELECT
  USING (private.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "partnership_messages restaurant member read" ON partnership_messages;
CREATE POLICY "partnership_messages restaurant member read"
  ON partnership_messages FOR SELECT
  USING (private.restaurant_member_relationship_access(relationship_id));

DROP POLICY IF EXISTS "partnership_messages restaurant member send" ON partnership_messages;
CREATE POLICY "partnership_messages restaurant member send"
  ON partnership_messages FOR INSERT
  WITH CHECK (
    sender_profile = auth.uid()
    AND sender_role = 'restaurant'
    AND (
      private.restaurant_member_relationship_access(relationship_id, 'partnership.manage')
      OR private.restaurant_member_relationship_access(relationship_id, 'order.submit')
    )
    AND EXISTS (
      SELECT 1 FROM restaurant_suppliers rs
      WHERE rs.id = relationship_id
        AND rs.status IN ('pending', 'active', 'paused')
    )
  );

DROP POLICY IF EXISTS "partnership_messages restaurant member mark read" ON partnership_messages;
CREATE POLICY "partnership_messages restaurant member mark read"
  ON partnership_messages FOR UPDATE
  USING (
    sender_profile <> auth.uid()
    AND private.restaurant_member_relationship_access(relationship_id)
  )
  WITH CHECK (sender_profile <> auth.uid());

-- --------------------------------------------------------------
-- 6. Restaurant catalogs (manual supplier price lists).
-- --------------------------------------------------------------
DROP POLICY IF EXISTS "restaurant_catalogs team member read" ON restaurant_catalogs;
CREATE POLICY "restaurant_catalogs team member read"
  ON restaurant_catalogs FOR SELECT
  USING (private.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "restaurant_catalogs team member manage" ON restaurant_catalogs;
CREATE POLICY "restaurant_catalogs team member manage"
  ON restaurant_catalogs FOR ALL
  USING (private.has_restaurant_permission(restaurant_id, 'partnership.manage'))
  WITH CHECK (private.has_restaurant_permission(restaurant_id, 'partnership.manage'));

DROP POLICY IF EXISTS "restaurant_catalog_items team member read" ON restaurant_catalog_items;
CREATE POLICY "restaurant_catalog_items team member read"
  ON restaurant_catalog_items FOR SELECT
  USING (private.restaurant_member_catalog_access(catalog_id));

DROP POLICY IF EXISTS "restaurant_catalog_items team member manage" ON restaurant_catalog_items;
CREATE POLICY "restaurant_catalog_items team member manage"
  ON restaurant_catalog_items FOR ALL
  USING (private.restaurant_member_catalog_access(catalog_id, 'partnership.manage'))
  WITH CHECK (private.restaurant_member_catalog_access(catalog_id, 'partnership.manage'));

-- --------------------------------------------------------------
-- 7. Preferences, saved orders, reviews.
-- --------------------------------------------------------------
DROP POLICY IF EXISTS "restaurant_preferences team member read" ON restaurant_preferences;
CREATE POLICY "restaurant_preferences team member read"
  ON restaurant_preferences FOR SELECT
  USING (private.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "restaurant_preferences team settings manage" ON restaurant_preferences;
CREATE POLICY "restaurant_preferences team settings manage"
  ON restaurant_preferences FOR ALL
  USING (private.has_restaurant_permission(restaurant_id, 'settings.manage'))
  WITH CHECK (private.has_restaurant_permission(restaurant_id, 'settings.manage'));

DROP POLICY IF EXISTS "restaurant_category_preferences team member read" ON restaurant_category_preferences;
CREATE POLICY "restaurant_category_preferences team member read"
  ON restaurant_category_preferences FOR SELECT
  USING (private.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "restaurant_category_preferences team settings manage" ON restaurant_category_preferences;
CREATE POLICY "restaurant_category_preferences team settings manage"
  ON restaurant_category_preferences FOR ALL
  USING (private.has_restaurant_permission(restaurant_id, 'settings.manage'))
  WITH CHECK (private.has_restaurant_permission(restaurant_id, 'settings.manage'));

DROP POLICY IF EXISTS "saved_orders team member read" ON saved_orders;
CREATE POLICY "saved_orders team member read"
  ON saved_orders FOR SELECT
  USING (private.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "saved_orders team template manage" ON saved_orders;
CREATE POLICY "saved_orders team template manage"
  ON saved_orders FOR ALL
  USING (private.has_restaurant_permission(restaurant_id, 'template.manage'))
  WITH CHECK (private.has_restaurant_permission(restaurant_id, 'template.manage'));

DROP POLICY IF EXISTS "reviews team member create" ON reviews;
CREATE POLICY "reviews team member create"
  ON reviews FOR INSERT
  WITH CHECK (private.has_restaurant_permission(restaurant_id, 'rating.submit'));
