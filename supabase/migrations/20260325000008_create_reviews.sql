-- GastroBridge: Reviews table
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id),
  supplier_id UUID REFERENCES suppliers(id),
  order_id UUID REFERENCES orders(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
  delivery_rating INTEGER CHECK (delivery_rating >= 1 AND delivery_rating <= 5),
  service_rating INTEGER CHECK (service_rating >= 1 AND service_rating <= 5),
  comment TEXT,
  supplier_reply TEXT,
  supplier_replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reviews_supplier_id ON reviews(supplier_id);
CREATE INDEX idx_reviews_restaurant_id ON reviews(restaurant_id);
CREATE INDEX idx_reviews_order_id ON reviews(order_id);

-- Trigger to update supplier rating_avg and rating_count
CREATE OR REPLACE FUNCTION update_supplier_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE suppliers SET
      rating_count = (SELECT COUNT(*) FROM reviews WHERE supplier_id = OLD.supplier_id),
      rating_avg = COALESCE((SELECT AVG(rating)::DECIMAL(2,1) FROM reviews WHERE supplier_id = OLD.supplier_id), 0)
    WHERE id = OLD.supplier_id;
    RETURN OLD;
  ELSE
    UPDATE suppliers SET
      rating_count = (SELECT COUNT(*) FROM reviews WHERE supplier_id = NEW.supplier_id),
      rating_avg = COALESCE((SELECT AVG(rating)::DECIMAL(2,1) FROM reviews WHERE supplier_id = NEW.supplier_id), 0)
    WHERE id = NEW.supplier_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_supplier_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_supplier_rating();
