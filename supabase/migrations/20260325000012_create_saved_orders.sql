-- GastroBridge: Saved Orders (templates for quick reorder)
CREATE TABLE saved_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  items JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_saved_orders_restaurant_id ON saved_orders(restaurant_id);

CREATE TRIGGER set_saved_orders_updated_at
  BEFORE UPDATE ON saved_orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();
