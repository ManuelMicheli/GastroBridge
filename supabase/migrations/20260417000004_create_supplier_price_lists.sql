-- GastroBridge: supplier_price_lists — listino personalizzato per relazione ristoratore↔fornitore
-- Il fornitore definisce prezzi/condizioni specifiche per un singolo cliente.
-- Prevale su products.price in ricerca/carrello quando esiste.

CREATE TABLE supplier_price_lists (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id uuid NOT NULL REFERENCES restaurant_suppliers(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES products(id)             ON DELETE CASCADE,
  custom_price    numeric(10,2) NOT NULL CHECK (custom_price >= 0),
  custom_min_qty  numeric(10,2) NULL CHECK (custom_min_qty IS NULL OR custom_min_qty > 0),
  valid_from      date NULL,
  valid_to        date NULL,
  notes           text NULL CHECK (notes IS NULL OR char_length(notes) <= 300),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (relationship_id, product_id),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);

CREATE INDEX idx_supplier_price_lists_relationship ON supplier_price_lists(relationship_id);
CREATE INDEX idx_supplier_price_lists_product      ON supplier_price_lists(product_id);

CREATE TRIGGER set_supplier_price_lists_updated_at
  BEFORE UPDATE ON supplier_price_lists
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE supplier_price_lists ENABLE ROW LEVEL SECURITY;

-- Supplier: CRUD completo sui listini delle proprie relazioni
CREATE POLICY "Supplier can manage own price lists"
  ON supplier_price_lists FOR ALL
  USING (
    relationship_id IN (
      SELECT rs.id FROM restaurant_suppliers rs
      JOIN suppliers s ON s.id = rs.supplier_id
      WHERE s.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    relationship_id IN (
      SELECT rs.id FROM restaurant_suppliers rs
      JOIN suppliers s ON s.id = rs.supplier_id
      WHERE s.profile_id = auth.uid()
    )
  );

-- Restaurant: solo SELECT, e solo su relazioni attive
CREATE POLICY "Restaurant can view own active price lists"
  ON supplier_price_lists FOR SELECT
  USING (
    relationship_id IN (
      SELECT rs.id FROM restaurant_suppliers rs
      JOIN restaurants r ON r.id = rs.restaurant_id
      WHERE r.profile_id = auth.uid()
        AND rs.status = 'active'
    )
  );
