-- GastroBridge: estende RLS esistenti per sfruttare restaurant_suppliers
-- NOTA: la policy originale "Suppliers can view restaurants that ordered from them"
-- resta in vigore come fallback per ordini storici. Aggiungiamo visibilità via partnership.

-- Fornitore può vedere il ristoratore se esiste relazione attiva/paused
CREATE POLICY "Suppliers can view restaurants with active partnership"
  ON restaurants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM restaurant_suppliers rs
      JOIN suppliers s ON s.id = rs.supplier_id
      WHERE rs.restaurant_id = restaurants.id
        AND s.profile_id = auth.uid()
        AND rs.status IN ('active','paused')
    )
  );

-- Funzione helper: verifica se esiste relazione attiva tra un ristoratore e un fornitore
-- Utile per server actions di gating ordini (chiamata lato server con admin client o RPC)
CREATE OR REPLACE FUNCTION has_active_relationship(
  p_restaurant_id uuid,
  p_supplier_id   uuid
)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM restaurant_suppliers
    WHERE restaurant_id = p_restaurant_id
      AND supplier_id   = p_supplier_id
      AND status = 'active'
  );
$$ LANGUAGE sql STABLE;
