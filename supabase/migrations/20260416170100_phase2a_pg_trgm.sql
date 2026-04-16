-- Phase 2A — pg_trgm fuzzy search fallback
--
-- Enables trigram search on product name/brand/sku so the app can
-- degrade gracefully to DB-side similarity when Meilisearch is
-- unavailable. Also powers "did you mean" suggestions.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON products USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_brand_trgm
  ON products USING GIN (brand gin_trgm_ops)
  WHERE brand IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_sku_trgm
  ON products USING GIN (sku gin_trgm_ops)
  WHERE sku IS NOT NULL;
