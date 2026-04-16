-- GastroBridge: collega restaurant_catalogs a fornitori registrati e relazioni
-- supplier_id/relationship_id NULL = fornitore non su GastroBridge (back-compat)

ALTER TABLE restaurant_catalogs
  ADD COLUMN supplier_id     uuid NULL REFERENCES suppliers(id)             ON DELETE SET NULL,
  ADD COLUMN relationship_id uuid NULL REFERENCES restaurant_suppliers(id)  ON DELETE SET NULL,
  ADD COLUMN source          catalog_source NOT NULL DEFAULT 'manual';

CREATE INDEX idx_restaurant_catalogs_supplier_id     ON restaurant_catalogs(supplier_id)     WHERE supplier_id     IS NOT NULL;
CREATE INDEX idx_restaurant_catalogs_relationship_id ON restaurant_catalogs(relationship_id) WHERE relationship_id IS NOT NULL;

-- Coerenza: se relationship_id è valorizzato, supplier_id deve corrispondere
ALTER TABLE restaurant_catalogs
  ADD CONSTRAINT restaurant_catalogs_relationship_supplier_match
  CHECK (
    relationship_id IS NULL OR supplier_id IS NOT NULL
  );

-- Policy aggiuntiva: fornitore registrato può SELECT cataloghi dei suoi clienti attivi
-- (per flusso "supplier_managed" e dashboard cliente)
CREATE POLICY "Supplier can view catalogs of active clients"
  ON restaurant_catalogs FOR SELECT
  USING (
    relationship_id IN (
      SELECT rs.id FROM restaurant_suppliers rs
      JOIN suppliers s ON s.id = rs.supplier_id
      WHERE s.profile_id = auth.uid()
        AND rs.status IN ('active','paused')
    )
  );

CREATE POLICY "Supplier can view items of active clients"
  ON restaurant_catalog_items FOR SELECT
  USING (
    catalog_id IN (
      SELECT rc.id FROM restaurant_catalogs rc
      JOIN restaurant_suppliers rs ON rs.id = rc.relationship_id
      JOIN suppliers s ON s.id = rs.supplier_id
      WHERE s.profile_id = auth.uid()
        AND rs.status IN ('active','paused')
    )
  );
