-- Phase 1B — Helper SQL transazionali per carichi / rettifiche stock.
-- Garantiscono atomicita' tra `stock_lots` e `stock_movements` lato DB, in modo
-- da evitare race condition quando il client Supabase non puo' aprire una
-- transazione esplicita.
--
-- Le funzioni sono SECURITY INVOKER: si affidano alle RLS gia' definite in
-- `20260417100000_phase1_foundations.sql` per l'autorizzazione. Il caller deve
-- comunque pre-validare il permesso applicativo (`stock.receive` / `stock.adjust`)
-- con `has_supplier_permission` prima di invocarle.

-- 1) receive_lot_tx — carico nuovo lotto con movimento 'receive'
CREATE OR REPLACE FUNCTION receive_lot_tx(
  p_product_id      uuid,
  p_warehouse_id    uuid,
  p_lot_code        text,
  p_expiry_date     date,
  p_quantity_base   numeric,
  p_cost_per_base   numeric,
  p_member_id       uuid,
  p_notes           text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_lot_id uuid;
BEGIN
  IF p_quantity_base IS NULL OR p_quantity_base <= 0 THEN
    RAISE EXCEPTION 'quantita non valida';
  END IF;

  INSERT INTO stock_lots (
    product_id, warehouse_id, lot_code, expiry_date,
    quantity_base, cost_per_base, received_at, notes
  )
  VALUES (
    p_product_id, p_warehouse_id, p_lot_code, p_expiry_date,
    p_quantity_base, p_cost_per_base, now(), p_notes
  )
  RETURNING id INTO v_lot_id;

  INSERT INTO stock_movements (
    product_id, lot_id, warehouse_id, quantity_base,
    movement_type, created_by_member_id, notes
  )
  VALUES (
    p_product_id, v_lot_id, p_warehouse_id, p_quantity_base,
    'receive', p_member_id, p_notes
  );

  RETURN v_lot_id;
END;
$$;

GRANT EXECUTE ON FUNCTION receive_lot_tx(uuid,uuid,text,date,numeric,numeric,uuid,text)
  TO authenticated;

-- 2) adjust_stock_tx — rettifica + movimento adjust_in/adjust_out
-- Per delta positivi senza lotto indicato, crea un nuovo lotto "rettifica".
-- Per delta negativi su lotto specifico, usa FOR UPDATE e decrementa.
-- La FEFO multi-lotto resta gestita lato applicazione (allocateFefo) che
-- richiama questa funzione con il lotto puntuale.
CREATE OR REPLACE FUNCTION adjust_stock_tx(
  p_product_id      uuid,
  p_warehouse_id    uuid,
  p_lot_id          uuid,
  p_delta_base      numeric,
  p_reason          text,
  p_member_id       uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_lot_id      uuid := p_lot_id;
  v_current     numeric;
  v_reserved    numeric;
  v_type        stock_movement_type;
  v_movement_id uuid;
BEGIN
  IF p_delta_base IS NULL OR p_delta_base = 0 THEN
    RAISE EXCEPTION 'delta non puo essere zero';
  END IF;

  IF p_delta_base > 0 THEN
    v_type := 'adjust_in';
    IF v_lot_id IS NULL THEN
      INSERT INTO stock_lots (
        product_id, warehouse_id, lot_code, expiry_date,
        quantity_base, cost_per_base, received_at, notes
      )
      VALUES (
        p_product_id, p_warehouse_id,
        'ADJ-' || to_char(now(), 'YYYYMMDDHH24MISS'),
        NULL, p_delta_base, NULL, now(), p_reason
      )
      RETURNING id INTO v_lot_id;
    ELSE
      -- lock row prima di incrementare
      SELECT quantity_base INTO v_current
        FROM stock_lots
       WHERE id = v_lot_id
         AND product_id = p_product_id
         AND warehouse_id = p_warehouse_id
       FOR UPDATE;
      IF v_current IS NULL THEN
        RAISE EXCEPTION 'lotto non trovato';
      END IF;
      UPDATE stock_lots
         SET quantity_base = quantity_base + p_delta_base
       WHERE id = v_lot_id;
    END IF;
  ELSE
    v_type := 'adjust_out';
    IF v_lot_id IS NULL THEN
      RAISE EXCEPTION 'lot_id richiesto per delta negativo';
    END IF;
    -- lock e controllo disponibilita' (quantity - reserved)
    SELECT quantity_base, quantity_reserved_base
      INTO v_current, v_reserved
      FROM stock_lots
     WHERE id = v_lot_id
       AND product_id = p_product_id
       AND warehouse_id = p_warehouse_id
     FOR UPDATE;
    IF v_current IS NULL THEN
      RAISE EXCEPTION 'lotto non trovato';
    END IF;
    IF (v_current + p_delta_base) < v_reserved THEN
      RAISE EXCEPTION 'stock insufficiente: prenotato %, disponibile dopo rettifica %',
        v_reserved, (v_current + p_delta_base);
    END IF;
    UPDATE stock_lots
       SET quantity_base = quantity_base + p_delta_base
     WHERE id = v_lot_id;
  END IF;

  INSERT INTO stock_movements (
    product_id, lot_id, warehouse_id, quantity_base,
    movement_type, created_by_member_id, notes
  )
  VALUES (
    p_product_id, v_lot_id, p_warehouse_id, p_delta_base,
    v_type, p_member_id, p_reason
  )
  RETURNING id INTO v_movement_id;

  RETURN v_movement_id;
END;
$$;

GRANT EXECUTE ON FUNCTION adjust_stock_tx(uuid,uuid,uuid,numeric,text,uuid)
  TO authenticated;
