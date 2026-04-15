-- Fix infinite recursion between restaurants and orders RLS policies.
--
-- The pre-existing supplier-view policy on restaurants did:
--   USING (EXISTS (SELECT 1 FROM orders o JOIN order_splits os ...))
-- which triggered orders' own RLS:
--   USING (restaurant_id IN (SELECT id FROM restaurants WHERE ...))
-- creating a cycle that fired on any INSERT ... RETURNING into restaurants.
--
-- Replace the policy with a SECURITY DEFINER helper that performs the
-- supplier <-> restaurant lookup with RLS bypassed.

DROP POLICY IF EXISTS "Suppliers can view restaurants that ordered from them" ON restaurants;

CREATE OR REPLACE FUNCTION supplier_has_seen_restaurant(_restaurant_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM orders o
    JOIN order_splits os ON os.order_id = o.id
    JOIN suppliers     s  ON os.supplier_id = s.id
    WHERE o.restaurant_id = _restaurant_id
      AND s.profile_id    = _user_id
  );
$$;

CREATE POLICY "Suppliers can view restaurants that ordered from them"
  ON restaurants FOR SELECT
  USING (supplier_has_seen_restaurant(restaurants.id, auth.uid()));
