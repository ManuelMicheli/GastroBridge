-- Plan 1C Task 3 — Migration supporto ordini + indici
-- RPC create_order_with_splits + CHECK constraints + workflow indexes

-- 1. RPC: create_order_with_splits
-- Transactionally insert into orders, order_items, order_splits, order_split_items, order_split_events.
-- SECURITY INVOKER → RLS applica per il ristorante chiamante.
-- Payload atteso:
-- {
--   "restaurant_id": uuid,
--   "notes": text | null,
--   "total": numeric,
--   "splits": [
--     {
--       "supplier_id": uuid,
--       "subtotal": numeric,
--       "warehouse_id": uuid | null,
--       "expected_delivery_date": date | null,
--       "delivery_zone_id": uuid | null,
--       "items": [
--         {
--           "product_id": uuid,
--           "sales_unit_id": uuid | null,
--           "quantity": numeric,
--           "unit_price": numeric,
--           "notes": text | null
--         }
--       ]
--     }
--   ]
-- }
-- Return: { order_id, split_ids: [ { supplier_id, split_id } ] }

CREATE OR REPLACE FUNCTION public.create_order_with_splits(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_restaurant_id uuid;
  v_total numeric;
  v_notes text;
  v_split jsonb;
  v_split_id uuid;
  v_supplier_id uuid;
  v_subtotal numeric;
  v_item jsonb;
  v_order_item_id uuid;
  v_split_ids jsonb := '[]'::jsonb;
BEGIN
  v_restaurant_id := (p_payload->>'restaurant_id')::uuid;
  v_total := COALESCE((p_payload->>'total')::numeric, 0);
  v_notes := p_payload->>'notes';

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'restaurant_id is required';
  END IF;

  IF p_payload->'splits' IS NULL OR jsonb_array_length(p_payload->'splits') = 0 THEN
    RAISE EXCEPTION 'at least one split is required';
  END IF;

  INSERT INTO public.orders (restaurant_id, total, status, notes)
  VALUES (v_restaurant_id, v_total, 'submitted', v_notes)
  RETURNING id INTO v_order_id;

  FOR v_split IN SELECT * FROM jsonb_array_elements(p_payload->'splits')
  LOOP
    v_supplier_id := (v_split->>'supplier_id')::uuid;
    v_subtotal := COALESCE((v_split->>'subtotal')::numeric, 0);

    IF v_supplier_id IS NULL THEN
      RAISE EXCEPTION 'supplier_id is required for every split';
    END IF;

    INSERT INTO public.order_splits (
      order_id, supplier_id, subtotal, status,
      warehouse_id, expected_delivery_date, delivery_zone_id
    )
    VALUES (
      v_order_id,
      v_supplier_id,
      v_subtotal,
      'submitted',
      NULLIF(v_split->>'warehouse_id','')::uuid,
      NULLIF(v_split->>'expected_delivery_date','')::date,
      NULLIF(v_split->>'delivery_zone_id','')::uuid
    )
    RETURNING id INTO v_split_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_split->'items')
    LOOP
      INSERT INTO public.order_items (
        order_id, product_id, supplier_id, quantity, unit_price, subtotal, notes, sales_unit_id
      )
      VALUES (
        v_order_id,
        (v_item->>'product_id')::uuid,
        v_supplier_id,
        (v_item->>'quantity')::numeric,
        (v_item->>'unit_price')::numeric,
        COALESCE((v_item->>'quantity')::numeric, 0) * COALESCE((v_item->>'unit_price')::numeric, 0),
        v_item->>'notes',
        NULLIF(v_item->>'sales_unit_id','')::uuid
      )
      RETURNING id INTO v_order_item_id;

      INSERT INTO public.order_split_items (
        order_split_id, order_item_id, product_id, sales_unit_id,
        quantity_requested, quantity_accepted, unit_price, status, notes
      )
      VALUES (
        v_split_id,
        v_order_item_id,
        (v_item->>'product_id')::uuid,
        NULLIF(v_item->>'sales_unit_id','')::uuid,
        (v_item->>'quantity')::numeric,
        NULL,
        (v_item->>'unit_price')::numeric,
        'pending',
        v_item->>'notes'
      );
    END LOOP;

    INSERT INTO public.order_split_events (order_split_id, event_type, metadata)
    VALUES (v_split_id, 'received', jsonb_build_object('source','create_order_with_splits'));

    v_split_ids := v_split_ids || jsonb_build_object('supplier_id', v_supplier_id, 'split_id', v_split_id);
  END LOOP;

  RETURN jsonb_build_object('order_id', v_order_id, 'splits', v_split_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_with_splits(jsonb) TO authenticated;

-- 2. CHECK constraints su order_split_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_split_items_qty_accepted_nonneg'
  ) THEN
    ALTER TABLE public.order_split_items
      ADD CONSTRAINT order_split_items_qty_accepted_nonneg
      CHECK (quantity_accepted IS NULL OR quantity_accepted >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_split_items_qty_accepted_sanity'
  ) THEN
    ALTER TABLE public.order_split_items
      ADD CONSTRAINT order_split_items_qty_accepted_sanity
      CHECK (quantity_accepted IS NULL OR quantity_accepted <= quantity_requested * 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_split_items_qty_requested_positive'
  ) THEN
    ALTER TABLE public.order_split_items
      ADD CONSTRAINT order_split_items_qty_requested_positive
      CHECK (quantity_requested > 0);
  END IF;
END $$;

-- 3. Indici workflow ordini
CREATE INDEX IF NOT EXISTS idx_osi_split_id
  ON public.order_split_items (order_split_id);

CREATE INDEX IF NOT EXISTS idx_osi_status
  ON public.order_split_items (status);

CREATE INDEX IF NOT EXISTS idx_order_splits_supplier_status
  ON public.order_splits (supplier_id, status);

CREATE INDEX IF NOT EXISTS idx_ose_split_created
  ON public.order_split_events (order_split_id, created_at DESC);
