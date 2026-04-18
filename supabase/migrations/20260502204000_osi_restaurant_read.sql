-- Allow restaurant owners to SELECT order_split_items for splits attached to
-- their own orders. Existing supplier "osi member read" policy stays in place
-- (RLS combines policies with OR), so suppliers retain read access via their
-- supplier-membership helper.
--
-- Without this, the chat ContextPanel "Ordini attivi" detail expansion returns
-- zero items for the restaurant viewpoint because the only existing SELECT
-- policy on order_split_items is supplier-scoped.

DROP POLICY IF EXISTS "osi restaurant read" ON public.order_split_items;
CREATE POLICY "osi restaurant read"
  ON public.order_split_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.order_splits os
      JOIN public.orders o      ON o.id = os.order_id
      JOIN public.restaurants r ON r.id = o.restaurant_id
      WHERE os.id = order_split_items.order_split_id
        AND r.profile_id = auth.uid()
    )
  );
