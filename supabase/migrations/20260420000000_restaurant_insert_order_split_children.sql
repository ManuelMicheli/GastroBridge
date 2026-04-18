-- Allow restaurant owner to INSERT order_split_items and order_split_events
-- for splits belonging to orders they own (used by create_order_with_splits RPC
-- which runs as SECURITY INVOKER — the caller is the restaurant user).
-- Existing supplier INSERT policies remain in effect (permissive OR).

DROP POLICY IF EXISTS "osi insert restaurant owner" ON public.order_split_items;
CREATE POLICY "osi insert restaurant owner"
  ON public.order_split_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.order_splits os
      JOIN public.orders o        ON o.id = os.order_id
      JOIN public.restaurants r   ON r.id = o.restaurant_id
      WHERE os.id = order_split_id
        AND r.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ose insert restaurant owner" ON public.order_split_events;
CREATE POLICY "ose insert restaurant owner"
  ON public.order_split_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.order_splits os
      JOIN public.orders o        ON o.id = os.order_id
      JOIN public.restaurants r   ON r.id = o.restaurant_id
      WHERE os.id = order_split_id
        AND r.profile_id = auth.uid()
    )
  );
