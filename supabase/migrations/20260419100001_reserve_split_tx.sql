-- Plan 1C Task 6 — Prenotazione stock FEFO + gestione conflitti
--
-- RPC transazionali:
--   reserve_split_tx(p_split_id uuid, p_member_id uuid) returns jsonb
--   unreserve_split_tx(p_split_id uuid, p_member_id uuid) returns jsonb
--
-- Convenzione stock_movements:
--   movement_type='order_reserve'   → quantity_base = -qty (riserva)
--   movement_type='order_unreserve' → quantity_base = +qty (rilascio)
-- I movimenti non modificano `stock_lots.quantity_base` (solo
-- `quantity_reserved_base`). L'invariante sullo stock fisico resta intatta:
-- il flusso di scarico reale avviene con `order_ship` in fase spedizione.
--
-- FEFO:
--   Ordina i lotti attivi (product_id, warehouse_id) per expiry_date ASC NULLS
--   LAST e received_at ASC. Alloca greedy fino a coprire quantity_accepted.
--   Usa FOR UPDATE per serializzare tentativi concorrenti (§7.6 spec).
--   Se la somma allocabile < richiesta → NON prenota, ritorna conflict e
--   inserisce un evento 'stock_conflict' sullo split.

CREATE OR REPLACE FUNCTION public.reserve_split_tx(
  p_split_id  uuid,
  p_member_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_split          RECORD;
  v_item           RECORD;
  v_lot            RECORD;
  v_remaining      numeric;
  v_take           numeric;
  v_available      numeric;
  v_total_avail    numeric;
  v_conflicts      jsonb := '[]'::jsonb;
  v_plans          jsonb := '[]'::jsonb;
  v_alloc          jsonb;
  v_plan_entry     jsonb;
BEGIN
  -- Fetch split + warehouse (FOR UPDATE sullo split per evitare doppia prenotazione)
  SELECT os.id, os.supplier_id, os.warehouse_id, os.status
    INTO v_split
    FROM order_splits os
   WHERE os.id = p_split_id
   FOR UPDATE;

  IF v_split.id IS NULL THEN
    RAISE EXCEPTION 'Split ordine non trovato';
  END IF;
  IF v_split.warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Magazzino non assegnato allo split';
  END IF;

  -- Lock di tutte le righe dello split (accepted/modified con quantity_accepted > 0)
  -- Prima pass: rileva conflitti senza modificare nulla (simulazione FEFO).
  FOR v_item IN
    SELECT osi.id, osi.product_id, osi.quantity_accepted, osi.status
      FROM order_split_items osi
     WHERE osi.order_split_id = p_split_id
       AND osi.status IN ('accepted','modified')
       AND COALESCE(osi.quantity_accepted, 0) > 0
     ORDER BY osi.id
     FOR UPDATE
  LOOP
    SELECT COALESCE(SUM(GREATEST(quantity_base - quantity_reserved_base, 0)), 0)
      INTO v_total_avail
      FROM stock_lots
     WHERE product_id = v_item.product_id
       AND warehouse_id = v_split.warehouse_id;

    IF v_total_avail < v_item.quantity_accepted THEN
      v_conflicts := v_conflicts || jsonb_build_object(
        'order_split_item_id', v_item.id,
        'product_id', v_item.product_id,
        'requested',  v_item.quantity_accepted,
        'available',  v_total_avail
      );
    END IF;
  END LOOP;

  -- Se c'e' anche un solo conflitto → non prenotare nulla, log evento e ritorna.
  IF jsonb_array_length(v_conflicts) > 0 THEN
    INSERT INTO order_split_events (order_split_id, event_type, member_id, metadata)
    VALUES (
      p_split_id,
      'stock_conflict',
      p_member_id,
      jsonb_build_object('conflicts', v_conflicts)
    );
    RETURN jsonb_build_object('ok', false, 'conflicts', v_conflicts);
  END IF;

  -- Seconda pass: alloca FEFO con FOR UPDATE sui lotti e aggiorna reserved.
  FOR v_item IN
    SELECT osi.id, osi.product_id, osi.quantity_accepted
      FROM order_split_items osi
     WHERE osi.order_split_id = p_split_id
       AND osi.status IN ('accepted','modified')
       AND COALESCE(osi.quantity_accepted, 0) > 0
     ORDER BY osi.id
  LOOP
    v_remaining := v_item.quantity_accepted;
    v_alloc := '[]'::jsonb;

    FOR v_lot IN
      SELECT id, quantity_base, quantity_reserved_base, lot_code, expiry_date, received_at
        FROM stock_lots
       WHERE product_id = v_item.product_id
         AND warehouse_id = v_split.warehouse_id
         AND (quantity_base - quantity_reserved_base) > 0
       ORDER BY expiry_date ASC NULLS LAST, received_at ASC
       FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_available := v_lot.quantity_base - v_lot.quantity_reserved_base;
      IF v_available <= 0 THEN CONTINUE; END IF;
      v_take := LEAST(v_available, v_remaining);

      UPDATE stock_lots
         SET quantity_reserved_base = quantity_reserved_base + v_take
       WHERE id = v_lot.id;

      INSERT INTO stock_movements (
        product_id, lot_id, warehouse_id, quantity_base,
        movement_type, ref_order_split_id, created_by_member_id, notes
      )
      VALUES (
        v_item.product_id, v_lot.id, v_split.warehouse_id, -v_take,
        'order_reserve', p_split_id, p_member_id,
        'Prenotazione FEFO split ' || p_split_id::text
      );

      v_alloc := v_alloc || jsonb_build_object(
        'lot_id', v_lot.id,
        'lot_code', v_lot.lot_code,
        'quantity_base', v_take
      );
      v_remaining := v_remaining - v_take;
    END LOOP;

    -- Safety: se remaining > 0 qui significa race condition tra le due pass.
    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'Conflitto concorrenza sul prodotto %: % unita non allocabili',
        v_item.product_id, v_remaining;
    END IF;

    v_plan_entry := jsonb_build_object(
      'order_split_item_id', v_item.id,
      'product_id', v_item.product_id,
      'quantity_reserved', v_item.quantity_accepted,
      'allocations', v_alloc
    );
    v_plans := v_plans || v_plan_entry;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'reservations', v_plans);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_split_tx(uuid, uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.unreserve_split_tx(
  p_split_id  uuid,
  p_member_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_split    RECORD;
  v_mov      RECORD;
  v_reversed jsonb := '[]'::jsonb;
  v_qty      numeric;
BEGIN
  SELECT os.id, os.warehouse_id
    INTO v_split
    FROM order_splits os
   WHERE os.id = p_split_id
   FOR UPDATE;

  IF v_split.id IS NULL THEN
    RAISE EXCEPTION 'Split ordine non trovato';
  END IF;

  -- Somma i movimenti order_reserve per lotto (netto eventuali unreserve gia' fatti).
  FOR v_mov IN
    SELECT sm.lot_id,
           sm.product_id,
           sm.warehouse_id,
           SUM(
             CASE WHEN sm.movement_type = 'order_reserve' THEN -sm.quantity_base
                  WHEN sm.movement_type = 'order_unreserve' THEN -sm.quantity_base
                  ELSE 0
             END
           ) AS net_reserved
      FROM stock_movements sm
     WHERE sm.ref_order_split_id = p_split_id
       AND sm.movement_type IN ('order_reserve','order_unreserve')
       AND sm.lot_id IS NOT NULL
     GROUP BY sm.lot_id, sm.product_id, sm.warehouse_id
  LOOP
    v_qty := v_mov.net_reserved;
    IF v_qty IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;

    -- Lock del lotto e decremento riservato.
    PERFORM 1 FROM stock_lots WHERE id = v_mov.lot_id FOR UPDATE;

    UPDATE stock_lots
       SET quantity_reserved_base = GREATEST(quantity_reserved_base - v_qty, 0)
     WHERE id = v_mov.lot_id;

    INSERT INTO stock_movements (
      product_id, lot_id, warehouse_id, quantity_base,
      movement_type, ref_order_split_id, created_by_member_id, notes
    )
    VALUES (
      v_mov.product_id, v_mov.lot_id, v_mov.warehouse_id, v_qty,
      'order_unreserve', p_split_id, p_member_id,
      'Rilascio prenotazione split ' || p_split_id::text
    );

    v_reversed := v_reversed || jsonb_build_object(
      'lot_id', v_mov.lot_id,
      'quantity_base', v_qty
    );
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'released', v_reversed);
END;
$$;

GRANT EXECUTE ON FUNCTION public.unreserve_split_tx(uuid, uuid) TO authenticated;
