-- GastroBridge: Products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id),
  subcategory_id UUID REFERENCES subcategories(id),
  name TEXT NOT NULL,
  description TEXT,
  brand TEXT,
  sku TEXT,
  unit unit_type NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  min_quantity DECIMAL(10,2) DEFAULT 1,
  max_quantity DECIMAL(10,2),
  image_url TEXT,
  certifications TEXT[],
  origin TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_supplier_id ON products(supplier_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_subcategory_id ON products(subcategory_id);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_is_available ON products(is_available);

-- Full-text search in Italian
CREATE INDEX idx_products_name_fts ON products
  USING GIN (to_tsvector('italian', name));

CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();
