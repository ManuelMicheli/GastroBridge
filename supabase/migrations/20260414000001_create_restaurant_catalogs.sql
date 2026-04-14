-- GastroBridge: restaurant personal supplier catalogs + items

CREATE TABLE restaurant_catalogs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id      uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  supplier_name      text NOT NULL CHECK (char_length(supplier_name) BETWEEN 1 AND 120),
  delivery_days      int  NULL CHECK (delivery_days IS NULL OR delivery_days >= 0),
  min_order_amount   numeric(10,2) NULL CHECK (min_order_amount IS NULL OR min_order_amount >= 0),
  notes              text NULL CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_restaurant_catalogs_restaurant_id ON restaurant_catalogs(restaurant_id);

CREATE TABLE restaurant_catalog_items (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id                uuid NOT NULL REFERENCES restaurant_catalogs(id) ON DELETE CASCADE,
  product_name              text NOT NULL CHECK (char_length(product_name) BETWEEN 1 AND 200),
  product_name_normalized   text NOT NULL,
  unit                      text NOT NULL CHECK (char_length(unit) BETWEEN 1 AND 20),
  price                     numeric(10,2) NOT NULL CHECK (price >= 0),
  notes                     text NULL CHECK (notes IS NULL OR char_length(notes) <= 200),
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_restaurant_catalog_items_catalog_id ON restaurant_catalog_items(catalog_id);
CREATE INDEX idx_restaurant_catalog_items_norm_unit ON restaurant_catalog_items(product_name_normalized, unit);

-- Trigger: keep updated_at current on restaurant_catalogs
CREATE OR REPLACE FUNCTION set_restaurant_catalogs_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_restaurant_catalogs_updated_at
  BEFORE UPDATE ON restaurant_catalogs
  FOR EACH ROW EXECUTE FUNCTION set_restaurant_catalogs_updated_at();

-- RLS
ALTER TABLE restaurant_catalogs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_catalog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant owner can manage own catalogs"
  ON restaurant_catalogs FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE profile_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE profile_id = auth.uid()));

CREATE POLICY "Restaurant owner can manage own catalog items"
  ON restaurant_catalog_items FOR ALL
  USING (
    catalog_id IN (
      SELECT rc.id FROM restaurant_catalogs rc
      JOIN restaurants r ON r.id = rc.restaurant_id
      WHERE r.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    catalog_id IN (
      SELECT rc.id FROM restaurant_catalogs rc
      JOIN restaurants r ON r.id = rc.restaurant_id
      WHERE r.profile_id = auth.uid()
    )
  );
