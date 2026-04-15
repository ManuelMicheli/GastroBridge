-- Plan 1C Task 12 — Picking list magazziniere con FEFO
--
-- RPC transazionali per il flusso picking:
--   pick_split_item_tx(p_split_item_id, p_lot_id, p_quantity_base, p_member_id)
--     returns jsonb
--   finalize_split_packing_tx(p_split_id, p_member_id) returns jsonb
--
-- Conferma fisica del prelievo: i lotti sono gia' prenotati dalla reservation
-- (quantity_reserved_base incrementato, movimento 'order_reserve' negativo).
-- Durante il picking decrementiamo sia quantity_base (uscita fisica) che
-- quantity_reserved_base (la quota prenotata diventa uscita). Registriamo un
-- movimento 'order_ship' negativo e creiamo delivery_items.
--
-- Invariante: quantity_reserved_base <= quantity_base viene preservata
-- decrementando entrambi dello stesso valore (v_take).
--
-- Serializzazione: SELECT ... FOR UPDATE sullo split + sul lotto per evitare
-- condizioni di gara con altre picking concorrenti o con unreserve.

CREATE OR REPLACE FUNCTION public.pick_split_item_tx(
  p_split_item_id uuid,
  p_lot_id        uuid,
  p_quantity_base numeric,
  p_member_id     uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_item          RECORD;
  v_split         RECORD;
  v_lot           RECORD;
  v_delivery_id   uuid;
  v_sales_conv    numeric;
  v_qty_sales     numeric;
BEGIN
  IF p_quantity_base IS NULL OR p_quantity_base <= 0 THEN
    RAISE EXCEPTION 'quantity_base must be > 0';
  END IF;

  -- Lock item + split
  SELECT osi.id, osi.order_split_id, osi.product_id, osi.sales_unit_id,
         osi.quantity_accepted, osi.status
    INTO v_item
    FROM order_split_items osi
   WHERE osi.id = p_split_item_id
   FOR UPDATE;

  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'Riga split non trovata';
  END IF;
  IF v_item.status NOT IN ('accepted','modified') THEN
    RAISE EXCEPTION 'Riga non prelevabile (status=%)', v_item.status;
  END IF;

  SELECT os.id, os.supplier_id, os.warehouse_id, os.expected_delivery_date
    INTO v_split
    FROM order_splits os
   WHERE os.id = v_item.order_split_id
   FOR UPDATE;

  IF v_split.warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Magazzino non assegnato allo split';
  END IF;

  -- Lock lotto e valida disponibilita' prenotata
  SELECT sl.id, sl.quantity_base, sl.quantity_reserved_base,
         sl.warehouse_id, sl.product_id
    INTO v_lot
    FROM stock_lots sl
   WHERE sl.id = p_lot_id
   FOR UPDATE;

  IF v_lot.id IS NULL THEN
    RAISE EXCEPTION 'Lotto non trovato';
  END IF;
  IF v_lot.warehouse_id <> v_split.warehouse_id THEN
    RAISE EXCEPTION 'Lotto su magazzino diverso dallo split';
  END IF;
  IF v_lot.product_id <> v_item.product_id THEN
    RAISE EXCEPTION 'Lotto di prodotto diverso dalla riga ordine';
  END IF;
  IF v_lot.quantity_base < p_quantity_base THEN
    RAISE EXCEPTION 'Giacenza lotto insufficiente (%, richiesti %)',
      v_lot.quantity_base, p_quantity_base;
  END IF;
  IF v_lot.quantity_reserved_base < p_quantity_base THEN
    RAISE EXCEPTION 'Quota prenotata lotto insufficiente (%, richiesti %)',
      v_lot.quantity_reserved_base, p_quantity_base;
  END IF;

  -- Ensure delivery record (planned) per questo split
  SELECT id INTO v_delivery_id
    FROM deliveries
   WHERE order_split_id = v_split.id
   ORDER BY created_at ASC
   LIMIT 1
   FOR UPDATE;

  IF v_delivery_id IS NULL THEN
    INSERT INTO deliveries (
      order_split_id, warehouse_id, scheduled_date, status
    ) VALUES (
      v_split.id,
      v_split.warehouse_id,
      COALESCE(v_split.expected_delivery_date, CURRENT_DATE),
      'planned'
    )
    RETURNING id INTO v_delivery_id;
  END IF;

  -- Calcolo quantity_sales_unit (ridondante per DDT)
  IF v_item.sales_unit_id IS NOT NULL THEN
    SELECT conversion_to_base INTO v_sales_conv
      FROM product_sales_units
     WHERE id = v_item.sales_unit_id;
  END IF;
  IF v_sales_conv IS NULL OR v_sales_conv <= 0 THEN
    v_sales_conv := 1;
  END IF;
  v_qty_sales := p_quantity_base / v_sales_conv;

  -- Decremento fisico + prenotato (invariante preservata: entrambi -v_take)
  UPDATE stock_lots
     SET quantity_base          = quantity_base - p_quantity_base,
         quantity_reserved_base = quantity_reserved_base - p_quantity_base
   WHERE id = v_lot.id;

  -- Delivery item
  INSERT INTO delivery_items (
    delivery_id, order_split_item_id, lot_id,
    quantity_base, quantity_sales_unit
  ) VALUES (
    v_delivery_id, v_item.id, v_lot.id,
    p_quantity_base, v_qty_sales
  );

  -- Movimento order_ship (negativo)
  INSERT INTO stock_movements (
    product_id, lot_id, warehouse_id, quantity_base,
    movement_type, ref_order_split_id, created_by_member_id, notes
  ) VALUES (
    v_item.product_id, v_lot.id, v_split.warehouse_id, -p_quantity_base,
    'order_ship', v_split.id, p_member_id,
    'Picking FEFO split ' || v_split.id::text
  );

  RETURN jsonb_build_object(
    'ok', true,
    'delivery_id', v_delivery_id,
    'order_split_item_id', v_item.id,
    'lot_id', v_lot.id,
    'quantity_base', p_quantity_base,
    'quantity_sales_unit', v_qty_sales
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pick_split_item_tx(uuid, uuid, numeric, uuid)
  TO authenticated;


-- Finalizza il picking: tutte le righe accepted/modified devono avere
-- delivery_items con sum(quantity_base) == quantity_accepted. Porta la
-- delivery da 'planned' a 'loaded'. Lo status dello split viene aggiornato
-- dal caller (markPacked server action) per rispettare il workflow-tag encoding.
CREATE OR REPLACE FUNCTION public.finalize_split_packing_tx(
  p_split_id  uuid,
  p_member_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_split        RECORD;
  v_missing      int;
  v_delivery_id  uuid;
BEGIN
  SELECT os.id, os.warehouse_id
    INTO v_split
    FROM order_splits os
   WHERE os.id = p_split_id
   FOR UPDATE;
  IF v_split.id IS NULL THEN
    RAISE EXCEPTION 'Split non trovato';
  END IF;

  -- Conta righe accepted/modified NON coperte interamente da delivery_items
  SELECT COUNT(*) INTO v_missing
    FROM order_split_items osi
    LEFT JOIN (
      SELECT order_split_item_id, SUM(quantity_base) AS total_picked
        FROM delivery_items
       GROUP BY order_split_item_id
    ) di ON di.order_split_item_id = osi.id
   WHERE osi.order_split_id = p_split_id
     AND osi.status IN ('accepted','modified')
     AND COALESCE(osi.quantity_accepted, 0) > 0
     AND (di.total_picked IS NULL
          OR di.total_picked < osi.quantity_accepted);

  IF v_missing > 0 THEN
    RAISE EXCEPTION 'Picking incompleto: % righe ancora da prelevare', v_missing;
  END IF;

  -- Porta la delivery a loaded
  SELECT id INTO v_delivery_id
    FROM deliveries
   WHERE order_split_id = p_split_id
   ORDER BY created_at ASC
   LIMIT 1
   FOR UPDATE;

  IF v_delivery_id IS NULL THEN
    RAISE EXCEPTION 'Delivery non creata: nessun picking registrato';
  END IF;

  UPDATE deliveries
     SET status = 'loaded'
   WHERE id = v_delivery_id;

  RETURN jsonb_build_object(
    'ok', true,
    'delivery_id', v_delivery_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_split_packing_tx(uuid, uuid)
  TO authenticated;
