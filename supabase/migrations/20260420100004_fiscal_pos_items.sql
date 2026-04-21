-- supabase/migrations/20260420100004_fiscal_pos_items.sql
-- Cassetto Fiscale: POS item catalog + soft mapping to GB products/categories

CREATE TABLE fiscal_pos_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id    UUID NOT NULL REFERENCES fiscal_integrations(id) ON DELETE CASCADE,
  pos_item_id       TEXT NOT NULL,
  name              TEXT NOT NULL,
  category          TEXT,
  first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_sold_cents  BIGINT NOT NULL DEFAULT 0,
  total_qty         DECIMAL(12,3) NOT NULL DEFAULT 0,
  UNIQUE(integration_id, pos_item_id)
);

CREATE INDEX idx_fiscal_pos_items_integration ON fiscal_pos_items(integration_id);

CREATE TABLE fiscal_pos_item_mappings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_item_id      UUID NOT NULL REFERENCES fiscal_pos_items(id) ON DELETE CASCADE,
  gb_product_id    UUID REFERENCES products(id),
  gb_category_id   UUID REFERENCES categories(id),
  depletion_ratio  DECIMAL(5,2) NOT NULL DEFAULT 1.0,
  source           TEXT NOT NULL DEFAULT 'user',
  confidence       DECIMAL(3,2),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (gb_product_id IS NOT NULL OR gb_category_id IS NOT NULL),
  CHECK (depletion_ratio BETWEEN 0 AND 1),
  CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  CHECK (source IN ('user','auto_heuristic','ml'))
);

-- Un POS item ha al massimo un mapping diretto a un prodotto GB
CREATE UNIQUE INDEX idx_fiscal_pos_mappings_product_unique
  ON fiscal_pos_item_mappings(pos_item_id)
  WHERE gb_product_id IS NOT NULL;

CREATE INDEX idx_fiscal_pos_mappings_pos_item ON fiscal_pos_item_mappings(pos_item_id);
