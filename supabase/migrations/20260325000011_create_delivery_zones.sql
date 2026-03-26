-- GastroBridge: Delivery Zones table (province/ZIP-based for MVP)
CREATE TABLE delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  zone_name TEXT,
  provinces TEXT[],
  zip_codes TEXT[],
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  free_delivery_above DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_delivery_zones_supplier_id ON delivery_zones(supplier_id);
