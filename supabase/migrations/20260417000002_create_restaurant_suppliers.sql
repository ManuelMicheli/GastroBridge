-- GastroBridge: restaurant_suppliers — partnership esplicita tra ristoratore e fornitore

CREATE TABLE restaurant_suppliers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  supplier_id    uuid NOT NULL REFERENCES suppliers(id)   ON DELETE CASCADE,
  status         relationship_status NOT NULL DEFAULT 'pending',
  invited_by     uuid NOT NULL REFERENCES profiles(id)    ON DELETE SET NULL,
  invited_at     timestamptz NOT NULL DEFAULT now(),
  responded_at   timestamptz NULL,
  notes          text NULL CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, supplier_id)
);

CREATE INDEX idx_restaurant_suppliers_restaurant ON restaurant_suppliers(restaurant_id, status);
CREATE INDEX idx_restaurant_suppliers_supplier   ON restaurant_suppliers(supplier_id, status);

CREATE TRIGGER set_restaurant_suppliers_updated_at
  BEFORE UPDATE ON restaurant_suppliers
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- Column protection trigger: forza chi può cambiare cosa
-- ============================================================
-- Supplier può cambiare: status, responded_at
-- Restaurant può cambiare: status (solo paused/archived), notes
-- Nessuno dei due può cambiare: restaurant_id, supplier_id, invited_by, invited_at, created_at
CREATE OR REPLACE FUNCTION protect_restaurant_suppliers_columns()
RETURNS trigger AS $$
DECLARE
  is_supplier   boolean := EXISTS (SELECT 1 FROM suppliers   WHERE id = OLD.supplier_id   AND profile_id = auth.uid());
  is_restaurant boolean := EXISTS (SELECT 1 FROM restaurants WHERE id = OLD.restaurant_id AND profile_id = auth.uid());
BEGIN
  -- Colonne sempre immutabili
  IF NEW.restaurant_id IS DISTINCT FROM OLD.restaurant_id
     OR NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
     OR NEW.invited_by  IS DISTINCT FROM OLD.invited_by
     OR NEW.invited_at  IS DISTINCT FROM OLD.invited_at
     OR NEW.created_at  IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Immutable columns on restaurant_suppliers cannot be changed';
  END IF;

  IF is_supplier AND NOT is_restaurant THEN
    -- Supplier: solo status + responded_at
    IF NEW.notes IS DISTINCT FROM OLD.notes THEN
      RAISE EXCEPTION 'Supplier cannot modify notes';
    END IF;
    -- Transizioni valide dal lato supplier
    IF NOT (
      (OLD.status = 'pending' AND NEW.status IN ('active','rejected')) OR
      (OLD.status = 'active'  AND NEW.status IN ('paused','active'))  OR
      (OLD.status = 'paused'  AND NEW.status IN ('active','paused'))  OR
      (OLD.status = NEW.status)
    ) THEN
      RAISE EXCEPTION 'Invalid status transition for supplier: % -> %', OLD.status, NEW.status;
    END IF;
    -- Auto-set responded_at quando si passa da pending
    IF OLD.status = 'pending' AND NEW.status <> 'pending' AND NEW.responded_at IS NULL THEN
      NEW.responded_at := now();
    END IF;

  ELSIF is_restaurant AND NOT is_supplier THEN
    -- Restaurant: solo status + notes; non può auto-accettare
    IF NEW.responded_at IS DISTINCT FROM OLD.responded_at THEN
      RAISE EXCEPTION 'Restaurant cannot modify responded_at';
    END IF;
    IF NOT (
      (OLD.status = 'active'   AND NEW.status IN ('paused','archived'))            OR
      (OLD.status = 'paused'   AND NEW.status IN ('active','archived'))            OR
      (OLD.status = 'pending'  AND NEW.status IN ('archived'))                     OR
      (OLD.status = 'rejected' AND NEW.status IN ('archived','pending'))           OR
      (OLD.status = 'archived' AND NEW.status IN ('pending'))                      OR
      (OLD.status = NEW.status)
    ) THEN
      RAISE EXCEPTION 'Invalid status transition for restaurant: % -> %', OLD.status, NEW.status;
    END IF;
    -- Re-invite: reset responded_at e invited_at quando si torna a pending
    IF OLD.status IN ('rejected','archived') AND NEW.status = 'pending' THEN
      NEW.responded_at := NULL;
      -- invited_at è immutabile per policy, ma consentiamo solo questo caso: bypass via UPDATE diretto
      -- (gestito lato action: usa INSERT nuovo vs UPDATE controllato)
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_protect_restaurant_suppliers
  BEFORE UPDATE ON restaurant_suppliers
  FOR EACH ROW
  EXECUTE FUNCTION protect_restaurant_suppliers_columns();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE restaurant_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant owner can view own relationships"
  ON restaurant_suppliers FOR SELECT
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE profile_id = auth.uid()));

CREATE POLICY "Restaurant owner can create invites"
  ON restaurant_suppliers FOR INSERT
  WITH CHECK (
    restaurant_id IN (SELECT id FROM restaurants WHERE profile_id = auth.uid())
    AND invited_by = auth.uid()
    AND status = 'pending'
  );

CREATE POLICY "Restaurant owner can update own relationships"
  ON restaurant_suppliers FOR UPDATE
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE profile_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE profile_id = auth.uid()));

CREATE POLICY "Restaurant owner can delete own relationships"
  ON restaurant_suppliers FOR DELETE
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE profile_id = auth.uid()));

CREATE POLICY "Supplier can view invitations received"
  ON restaurant_suppliers FOR SELECT
  USING (supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid()));

CREATE POLICY "Supplier can respond to invitations"
  ON restaurant_suppliers FOR UPDATE
  USING (supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid()))
  WITH CHECK (supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid()));

-- Realtime per aggiornamenti live dello stato relazione
ALTER PUBLICATION supabase_realtime ADD TABLE restaurant_suppliers;
