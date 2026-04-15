-- GastroBridge: enrich products + suppliers for quality-aware scoring (Phase: intelligent search)

-- Enrich products with quality-aware fields
CREATE TYPE quality_tier AS ENUM ('economy','standard','premium','luxury');
CREATE TYPE category_macro AS ENUM ('carne','pesce','verdura','frutta','latticini','secco','bevande','surgelati','panetteria','altro');
CREATE TYPE certification_type AS ENUM ('DOP','IGP','STG','BIO','DOC','DOCG','IGT','HALAL','KOSHER','MSC','ASC','FAIRTRADE');

ALTER TABLE products
  ADD COLUMN quality_tier quality_tier NOT NULL DEFAULT 'standard',
  ADD COLUMN is_bio BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN lead_time_days INT NOT NULL DEFAULT 1 CHECK (lead_time_days >= 0),
  ADD COLUMN packaging_size NUMERIC(10,3),
  ADD COLUMN packaging_unit TEXT,
  ADD COLUMN certifications_structured certification_type[] NOT NULL DEFAULT ARRAY[]::certification_type[],
  ADD COLUMN cold_chain_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN origin_country TEXT,
  ADD COLUMN origin_region TEXT,
  ADD COLUMN macro_category category_macro NOT NULL DEFAULT 'altro';

CREATE INDEX idx_products_quality_tier ON products(quality_tier);
CREATE INDEX idx_products_macro_category ON products(macro_category);
CREATE INDEX idx_products_is_bio ON products(is_bio) WHERE is_bio = TRUE;
CREATE INDEX idx_products_certifications_structured ON products USING GIN (certifications_structured);

ALTER TABLE suppliers
  ADD COLUMN delivery_schedule JSONB,  -- { days: ['mon','thu'], cutoff_time: '14:00', same_day: false }
  ADD COLUMN payment_terms_days INT NOT NULL DEFAULT 30 CHECK (payment_terms_days >= 0),
  ADD COLUMN cold_chain_available BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN suppliers.delivery_schedule IS 'Structured delivery schedule: { days: day_of_week[], cutoff_time: HH:MM, same_day: bool }';
