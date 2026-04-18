-- Fix infinite RLS recursion introduced by 20260420000001_supplier_read_orders_customers.sql.
-- Cycle:
--   restaurants SELECT (inline EXISTS over order_splits)
--     -> reads order_splits
--       -> order_splits SELECT (subquery on orders+restaurants)
--         -> reads restaurants -> repeat
-- Fix per project policy: use SECURITY DEFINER STABLE helpers instead of inline
-- EXISTS that traverse RLS-protected tables.

-- 1. Drop the redundant recursive policy on restaurants. Two existing
--    SECURITY DEFINER policies already cover identical access:
--      * "Suppliers can view restaurants that ordered from them"  (helper: supplier_has_seen_restaurant)
--      * "Suppliers can view restaurants with partnership"        (helper: supplier_has_partnership_with_restaurant, status IN active/paused/pending)
DROP POLICY IF EXISTS "restaurants supplier read customers" ON public.restaurants;

-- 2. Replace the recursive orders SELECT policy with a SECURITY DEFINER helper.
CREATE OR REPLACE FUNCTION public.supplier_owns_any_split_of_order(_order_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM order_splits os
    JOIN suppliers    s  ON s.id = os.supplier_id
    WHERE os.order_id = _order_id
      AND s.profile_id = _user_id
  );
$$;

DROP POLICY IF EXISTS "orders supplier read own splits" ON public.orders;
CREATE POLICY "orders supplier read own splits"
  ON public.orders FOR SELECT
  USING (
    public.supplier_owns_any_split_of_order(id, auth.uid())
  );
