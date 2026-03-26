-- GastroBridge: Price History table with triggers
CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  price DECIMAL(10,2) NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_price_history_product_id ON price_history(product_id);
CREATE INDEX idx_price_history_recorded_at ON price_history(recorded_at DESC);

-- Record initial price on product creation
CREATE OR REPLACE FUNCTION record_initial_price()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO price_history (product_id, price)
  VALUES (NEW.id, NEW.price);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_record_initial_price
  AFTER INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION record_initial_price();

-- Record price change on product update
CREATE OR REPLACE FUNCTION record_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.price IS DISTINCT FROM NEW.price THEN
    INSERT INTO price_history (product_id, price)
    VALUES (NEW.id, NEW.price);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_record_price_change
  AFTER UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION record_price_change();
