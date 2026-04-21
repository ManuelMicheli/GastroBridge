-- supabase/migrations/20260420100008_fiscal_rls.sql
-- Cassetto Fiscale: RLS helper + policies on all fiscal_* tables.
--
-- Ownership is owner-based: restaurants.profile_id = auth.uid().
-- Uso funzione SECURITY DEFINER per evitare ricorsione RLS (vedi feedback_rls_recursion.md).

CREATE OR REPLACE FUNCTION fiscal_owns_restaurant(_restaurant_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM restaurants r
    WHERE r.id = _restaurant_id
      AND r.profile_id = _user_id
  );
$$;

REVOKE EXECUTE ON FUNCTION fiscal_owns_restaurant(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fiscal_owns_restaurant(UUID, UUID) TO authenticated;

-- fiscal_integrations: read-only per owner; scritture via service_role.
ALTER TABLE fiscal_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_integrations owner select"
  ON fiscal_integrations FOR SELECT
  USING (fiscal_owns_restaurant(restaurant_id, auth.uid()));

-- fiscal_raw_events: no user policy (default deny). Service role writes.
ALTER TABLE fiscal_raw_events ENABLE ROW LEVEL SECURITY;

-- fiscal_receipts
ALTER TABLE fiscal_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_receipts owner select"
  ON fiscal_receipts FOR SELECT
  USING (fiscal_owns_restaurant(restaurant_id, auth.uid()));

-- fiscal_receipt_items (via receipt)
ALTER TABLE fiscal_receipt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_receipt_items owner select"
  ON fiscal_receipt_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM fiscal_receipts r
      WHERE r.id = fiscal_receipt_items.receipt_id
        AND fiscal_owns_restaurant(r.restaurant_id, auth.uid())
    )
  );

-- fiscal_pos_items (via integration)
ALTER TABLE fiscal_pos_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_pos_items owner select"
  ON fiscal_pos_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM fiscal_integrations i
      WHERE i.id = fiscal_pos_items.integration_id
        AND fiscal_owns_restaurant(i.restaurant_id, auth.uid())
    )
  );

-- fiscal_pos_item_mappings: owner può gestire mappings (utile per UI mapping)
ALTER TABLE fiscal_pos_item_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_pos_item_mappings owner select"
  ON fiscal_pos_item_mappings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM fiscal_pos_items p
      JOIN fiscal_integrations i ON i.id = p.integration_id
      WHERE p.id = fiscal_pos_item_mappings.pos_item_id
        AND fiscal_owns_restaurant(i.restaurant_id, auth.uid())
    )
  );

CREATE POLICY "fiscal_pos_item_mappings owner insert"
  ON fiscal_pos_item_mappings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM fiscal_pos_items p
      JOIN fiscal_integrations i ON i.id = p.integration_id
      WHERE p.id = fiscal_pos_item_mappings.pos_item_id
        AND fiscal_owns_restaurant(i.restaurant_id, auth.uid())
    )
  );

CREATE POLICY "fiscal_pos_item_mappings owner update"
  ON fiscal_pos_item_mappings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM fiscal_pos_items p
      JOIN fiscal_integrations i ON i.id = p.integration_id
      WHERE p.id = fiscal_pos_item_mappings.pos_item_id
        AND fiscal_owns_restaurant(i.restaurant_id, auth.uid())
    )
  );

CREATE POLICY "fiscal_pos_item_mappings owner delete"
  ON fiscal_pos_item_mappings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM fiscal_pos_items p
      JOIN fiscal_integrations i ON i.id = p.integration_id
      WHERE p.id = fiscal_pos_item_mappings.pos_item_id
        AND fiscal_owns_restaurant(i.restaurant_id, auth.uid())
    )
  );

-- reorder_suggestions: owner legge e aggiorna state (dismiss/acted)
ALTER TABLE reorder_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reorder_suggestions owner select"
  ON reorder_suggestions FOR SELECT
  USING (fiscal_owns_restaurant(restaurant_id, auth.uid()));

CREATE POLICY "reorder_suggestions owner update state"
  ON reorder_suggestions FOR UPDATE
  USING (fiscal_owns_restaurant(restaurant_id, auth.uid()))
  WITH CHECK (fiscal_owns_restaurant(restaurant_id, auth.uid()));
