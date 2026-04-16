-- GastroBridge: partnership_messages — thread di messaggistica legato a una relazione

CREATE TABLE partnership_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id uuid NOT NULL REFERENCES restaurant_suppliers(id) ON DELETE CASCADE,
  sender_role     user_role NOT NULL CHECK (sender_role IN ('restaurant','supplier')),
  sender_profile  uuid NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  body            text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  attachments     jsonb NULL,
  read_at         timestamptz NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_partnership_messages_relationship ON partnership_messages(relationship_id, created_at DESC);
CREATE INDEX idx_partnership_messages_unread       ON partnership_messages(relationship_id) WHERE read_at IS NULL;

-- ============================================================
-- RLS — entrambe le parti della relazione possono leggere/inserire
-- Update consentito solo per segnare read_at dal destinatario
-- ============================================================
ALTER TABLE partnership_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties can view messages in their relationship"
  ON partnership_messages FOR SELECT
  USING (
    relationship_id IN (
      SELECT rs.id FROM restaurant_suppliers rs
      LEFT JOIN restaurants r ON r.id = rs.restaurant_id
      LEFT JOIN suppliers   s ON s.id = rs.supplier_id
      WHERE r.profile_id = auth.uid() OR s.profile_id = auth.uid()
    )
  );

CREATE POLICY "Parties can send messages in active relationships"
  ON partnership_messages FOR INSERT
  WITH CHECK (
    sender_profile = auth.uid()
    AND relationship_id IN (
      SELECT rs.id FROM restaurant_suppliers rs
      LEFT JOIN restaurants r ON r.id = rs.restaurant_id
      LEFT JOIN suppliers   s ON s.id = rs.supplier_id
      WHERE (r.profile_id = auth.uid() OR s.profile_id = auth.uid())
        AND rs.status IN ('pending','active','paused')
    )
    AND (
      (sender_role = 'restaurant' AND EXISTS (
        SELECT 1 FROM restaurant_suppliers rs
        JOIN restaurants r ON r.id = rs.restaurant_id
        WHERE rs.id = relationship_id AND r.profile_id = auth.uid()
      ))
      OR
      (sender_role = 'supplier' AND EXISTS (
        SELECT 1 FROM restaurant_suppliers rs
        JOIN suppliers s ON s.id = rs.supplier_id
        WHERE rs.id = relationship_id AND s.profile_id = auth.uid()
      ))
    )
  );

-- Update limitato: solo read_at, solo se non sei il mittente
CREATE POLICY "Recipient can mark message as read"
  ON partnership_messages FOR UPDATE
  USING (
    sender_profile <> auth.uid()
    AND relationship_id IN (
      SELECT rs.id FROM restaurant_suppliers rs
      LEFT JOIN restaurants r ON r.id = rs.restaurant_id
      LEFT JOIN suppliers   s ON s.id = rs.supplier_id
      WHERE r.profile_id = auth.uid() OR s.profile_id = auth.uid()
    )
  )
  WITH CHECK (sender_profile <> auth.uid());

-- Trigger: impedisce modifiche a colonne diverse da read_at
CREATE OR REPLACE FUNCTION protect_partnership_messages_columns()
RETURNS trigger AS $$
BEGIN
  IF NEW.relationship_id IS DISTINCT FROM OLD.relationship_id
     OR NEW.sender_role  IS DISTINCT FROM OLD.sender_role
     OR NEW.sender_profile IS DISTINCT FROM OLD.sender_profile
     OR NEW.body         IS DISTINCT FROM OLD.body
     OR NEW.attachments  IS DISTINCT FROM OLD.attachments
     OR NEW.created_at   IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only read_at can be updated on partnership_messages';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_partnership_messages
  BEFORE UPDATE ON partnership_messages
  FOR EACH ROW
  EXECUTE FUNCTION protect_partnership_messages_columns();

-- Realtime per chat live
ALTER PUBLICATION supabase_realtime ADD TABLE partnership_messages;
