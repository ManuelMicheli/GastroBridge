-- Supplier can SELECT orders that have at least one split assigned to them
-- (needed to display timestamps/customers on supplier dashboard + orders list).
DROP POLICY IF EXISTS "orders supplier read own splits" ON public.orders;
CREATE POLICY "orders supplier read own splits"
  ON public.orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.order_splits os
      JOIN public.suppliers s ON s.id = os.supplier_id
      WHERE os.order_id = orders.id
        AND s.profile_id = auth.uid()
    )
  );

-- Supplier can SELECT restaurants that have ordered from them, or that have
-- a partnership relationship (active/paused/pending) — needed for supplier
-- dashboard, orders list and clients list to resolve restaurant names.
DROP POLICY IF EXISTS "restaurants supplier read customers" ON public.restaurants;
CREATE POLICY "restaurants supplier read customers"
  ON public.restaurants FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.order_splits os
      JOIN public.orders o    ON o.id = os.order_id
      JOIN public.suppliers s ON s.id = os.supplier_id
      WHERE o.restaurant_id = restaurants.id
        AND s.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.restaurant_suppliers rs
      JOIN public.suppliers s ON s.id = rs.supplier_id
      WHERE rs.restaurant_id = restaurants.id
        AND s.profile_id = auth.uid()
        AND rs.status IN ('active','paused','pending')
    )
  );
