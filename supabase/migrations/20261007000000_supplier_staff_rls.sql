-- Supplier staff access.
--
-- The original (pre-Phase-1) RLS policies on order_splits, products,
-- restaurant_suppliers, orders, restaurants, partnership_messages,
-- delivery_zones, reviews and suppliers only match the OWNER
-- (`suppliers.profile_id = auth.uid()`). Staff members (sales / warehouse /
-- driver in `supplier_members`) therefore saw empty pages even though the app
-- now resolves the supplier through `supplier_members`.
--
-- This migration is purely ADDITIVE: it adds member-based policies next to the
-- owner ones (policies are OR-ed), gated with the same permission matrix as
-- the app (role_permissions / lib/supplier/permissions.ts). The owner is a
-- backfilled `admin` member, so nothing is taken away from anyone.
--
-- Helpers that traverse RLS-protected tables are SECURITY DEFINER in the
-- `private` schema (not exposed by PostgREST), like the existing ones, to
-- avoid policy recursion.

-- --------------------------------------------------------------
-- 1. Helpers
-- --------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.supplier_member_of_any_split_of_order(_order_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM order_splits os
    JOIN supplier_members sm ON sm.supplier_id = os.supplier_id
    WHERE os.order_id     = _order_id
      AND sm.profile_id   = _user_id
      AND sm.is_active    = true
      AND sm.accepted_at IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION private.supplier_member_sees_restaurant(_restaurant_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM supplier_members sm
    WHERE sm.profile_id   = _user_id
      AND sm.is_active    = true
      AND sm.accepted_at IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM restaurant_suppliers rs
          WHERE rs.supplier_id   = sm.supplier_id
            AND rs.restaurant_id = _restaurant_id
        )
        OR EXISTS (
          SELECT 1 FROM orders o
          JOIN order_splits os ON os.order_id = o.id
          WHERE os.supplier_id   = sm.supplier_id
            AND o.restaurant_id  = _restaurant_id
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.supplier_member_of_relationship(_relationship_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM restaurant_suppliers rs
    JOIN supplier_members sm ON sm.supplier_id = rs.supplier_id
    WHERE rs.id           = _relationship_id
      AND sm.profile_id   = _user_id
      AND sm.is_active    = true
      AND sm.accepted_at IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION private.supplier_member_of_any_split_of_order(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.supplier_member_sees_restaurant(uuid, uuid)       FROM PUBLIC;
REVOKE ALL ON FUNCTION private.supplier_member_of_relationship(uuid, uuid)       FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.supplier_member_of_any_split_of_order(uuid, uuid),
                         private.supplier_member_sees_restaurant(uuid, uuid),
                         private.supplier_member_of_relationship(uuid, uuid)
  TO authenticated;

-- --------------------------------------------------------------
-- 2. suppliers — members read their own supplier (even if inactive);
--    settings.manage may update it.
-- --------------------------------------------------------------
DROP POLICY IF EXISTS "suppliers member read" ON suppliers;
CREATE POLICY "suppliers member read"
  ON suppliers FOR SELECT
  USING (is_supplier_member(id));

DROP POLICY IF EXISTS "suppliers settings manage update" ON suppliers;
CREATE POLICY "suppliers settings manage update"
  ON suppliers FOR UPDATE
  USING (has_supplier_permission(id, 'settings.manage'))
  WITH CHECK (has_supplier_permission(id, 'settings.manage'));

-- --------------------------------------------------------------
-- 3. order_splits — every member reads; workflow roles update.
-- --------------------------------------------------------------
DROP POLICY IF EXISTS "order_splits member read" ON order_splits;
CREATE POLICY "order_splits member read"
  ON order_splits FOR SELECT
  USING (is_supplier_member(supplier_id));

DROP POLICY IF EXISTS "order_splits member workflow update" ON order_splits;
CREATE POLICY "order_splits member workflow update"
  ON order_splits FOR UPDATE
  USING (
    has_supplier_permission(supplier_id, 'order.accept_line')
    OR has_supplier_permission(supplier_id, 'order.prepare')
    OR has_supplier_permission(supplier_id, 'delivery.execute')
  )
  WITH CHECK (
    has_supplier_permission(supplier_id, 'order.accept_line')
    OR has_supplier_permission(supplier_id, 'order.prepare')
    OR has_supplier_permission(supplier_id, 'delivery.execute')
  );

-- --------------------------------------------------------------
-- 4. orders / restaurants — read for members of a supplier involved.
-- --------------------------------------------------------------
DROP POLICY IF EXISTS "orders supplier member read" ON orders;
CREATE POLICY "orders supplier member read"
  ON orders FOR SELECT
  USING (private.supplier_member_of_any_split_of_order(id, auth.uid()));

DROP POLICY IF EXISTS "restaurants supplier member read" ON restaurants;
CREATE POLICY "restaurants supplier member read"
  ON restaurants FOR SELECT
  USING (private.supplier_member_sees_restaurant(id, auth.uid()));

-- --------------------------------------------------------------
-- 5. products — members read all own products; catalog.edit writes.
-- --------------------------------------------------------------
DROP POLICY IF EXISTS "products member read" ON products;
CREATE POLICY "products member read"
  ON products FOR SELECT
  USING (is_supplier_member(supplier_id));

DROP POLICY IF EXISTS "products catalog edit insert" ON products;
CREATE POLICY "products catalog edit insert"
  ON products FOR INSERT
  WITH CHECK (has_supplier_permission(supplier_id, 'catalog.edit'));

DROP POLICY IF EXISTS "products catalog edit update" ON products;
CREATE POLICY "products catalog edit update"
  ON products FOR UPDATE
  USING (has_supplier_permission(supplier_id, 'catalog.edit'))
  WITH CHECK (has_supplier_permission(supplier_id, 'catalog.edit'));

DROP POLICY IF EXISTS "products catalog edit delete" ON products;
CREATE POLICY "products catalog edit delete"
  ON products FOR DELETE
  USING (has_supplier_permission(supplier_id, 'catalog.edit'));

-- --------------------------------------------------------------
-- 6. restaurant_suppliers — members read; admin + sales respond.
--    (order.accept_line is granted exactly to admin + sales.)
-- --------------------------------------------------------------
DROP POLICY IF EXISTS "restaurant_suppliers member read" ON restaurant_suppliers;
CREATE POLICY "restaurant_suppliers member read"
  ON restaurant_suppliers FOR SELECT
  USING (is_supplier_member(supplier_id));

DROP POLICY IF EXISTS "restaurant_suppliers commercial update" ON restaurant_suppliers;
CREATE POLICY "restaurant_suppliers commercial update"
  ON restaurant_suppliers FOR UPDATE
  USING (has_supplier_permission(supplier_id, 'order.accept_line'))
  WITH CHECK (has_supplier_permission(supplier_id, 'order.accept_line'));

-- --------------------------------------------------------------
-- 7. partnership_messages — members chat as "supplier".
-- --------------------------------------------------------------
DROP POLICY IF EXISTS "partnership_messages supplier member read" ON partnership_messages;
CREATE POLICY "partnership_messages supplier member read"
  ON partnership_messages FOR SELECT
  USING (private.supplier_member_of_relationship(relationship_id, auth.uid()));

DROP POLICY IF EXISTS "partnership_messages supplier member send" ON partnership_messages;
CREATE POLICY "partnership_messages supplier member send"
  ON partnership_messages FOR INSERT
  WITH CHECK (
    sender_profile = auth.uid()
    AND sender_role = 'supplier'
    AND private.supplier_member_of_relationship(relationship_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM restaurant_suppliers rs
      WHERE rs.id = relationship_id
        AND rs.status IN ('pending', 'active', 'paused')
    )
  );

DROP POLICY IF EXISTS "partnership_messages supplier member mark read" ON partnership_messages;
CREATE POLICY "partnership_messages supplier member mark read"
  ON partnership_messages FOR UPDATE
  USING (
    sender_profile <> auth.uid()
    AND private.supplier_member_of_relationship(relationship_id, auth.uid())
  )
  WITH CHECK (sender_profile <> auth.uid());

-- --------------------------------------------------------------
-- 8. delivery_zones (settings.manage) and review replies (reviews.reply).
-- --------------------------------------------------------------
DROP POLICY IF EXISTS "delivery_zones settings manage" ON delivery_zones;
CREATE POLICY "delivery_zones settings manage"
  ON delivery_zones FOR ALL
  USING (has_supplier_permission(supplier_id, 'settings.manage'))
  WITH CHECK (has_supplier_permission(supplier_id, 'settings.manage'));

DROP POLICY IF EXISTS "reviews member reply" ON reviews;
CREATE POLICY "reviews member reply"
  ON reviews FOR UPDATE
  USING (has_supplier_permission(supplier_id, 'reviews.reply'))
  WITH CHECK (has_supplier_permission(supplier_id, 'reviews.reply'));
