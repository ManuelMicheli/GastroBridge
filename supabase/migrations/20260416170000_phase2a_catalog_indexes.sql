-- Phase 2A — Catalog scale indexes + multi-column FTS
--
-- Adds composite indexes for keyset pagination and sort variants on
-- products, and replaces the name-only FTS index with a generated
-- tsvector column spanning name/description/brand/sku for richer search.

-- ------------------------------------------------------------------
-- 1. Composite indexes for keyset pagination + sort
-- ------------------------------------------------------------------

-- Default listing: supplier's products ordered by created_at desc,
-- with is_available as common filter.
CREATE INDEX IF NOT EXISTS idx_products_supplier_avail_created
  ON products (supplier_id, is_available, created_at DESC);

-- Alphabetical sort + keyset on (name, id) within a supplier.
CREATE INDEX IF NOT EXISTS idx_products_supplier_name
  ON products (supplier_id, name);

-- Price sort within a supplier.
CREATE INDEX IF NOT EXISTS idx_products_supplier_price
  ON products (supplier_id, price);

-- ------------------------------------------------------------------
-- 2. Multi-column FTS via generated column
-- ------------------------------------------------------------------

DROP INDEX IF EXISTS idx_products_name_fts;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
    GENERATED ALWAYS AS (
      to_tsvector(
        'italian',
        coalesce(name, '') || ' ' ||
        coalesce(description, '') || ' ' ||
        coalesce(brand, '') || ' ' ||
        coalesce(sku, '')
      )
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_products_search_tsv
  ON products USING GIN (search_tsv);
