-- supabase/migrations/20260420100006_fiscal_reorder.sql
-- Cassetto Fiscale: reorder suggestions table

CREATE TABLE reorder_suggestions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id            UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  product_id               UUID REFERENCES products(id),
  category_id              UUID REFERENCES categories(id),
  suggested_qty            DECIMAL(10,2),
  suggested_unit           TEXT,
  estimated_coverage_days  INT,
  urgency                  reorder_urgency NOT NULL,
  reason                   TEXT NOT NULL,
  preferred_supplier_id    UUID REFERENCES suppliers(id),
  snapshot                 JSONB NOT NULL,
  state                    TEXT NOT NULL DEFAULT 'open',
  acted_order_id           UUID REFERENCES orders(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at               TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '3 days'),
  CHECK (product_id IS NOT NULL OR category_id IS NOT NULL),
  CHECK (state IN ('open','acted','dismissed','expired'))
);

-- Un solo suggerimento "open" per (ristorante, product) o (ristorante, category)
CREATE UNIQUE INDEX idx_reorder_suggestions_open_product
  ON reorder_suggestions(restaurant_id, product_id)
  WHERE state = 'open' AND product_id IS NOT NULL;

CREATE UNIQUE INDEX idx_reorder_suggestions_open_category
  ON reorder_suggestions(restaurant_id, category_id)
  WHERE state = 'open' AND product_id IS NULL AND category_id IS NOT NULL;

CREATE INDEX idx_reorder_suggestions_list
  ON reorder_suggestions(restaurant_id, state, urgency)
  WHERE state = 'open';
