-- GastroBridge: restaurant supply preferences (hard constraints + soft weights)

CREATE TYPE preset_profile AS ENUM ('custom','stellato','trattoria','pizzeria','bar','mensa');

CREATE TABLE restaurant_preferences (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id              uuid NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
  -- Hard constraints
  min_order_max_eur          numeric(10,2) CHECK (min_order_max_eur IS NULL OR min_order_max_eur >= 0),
  lead_time_max_days         int CHECK (lead_time_max_days IS NULL OR lead_time_max_days >= 0),
  required_certifications    certification_type[] NOT NULL DEFAULT ARRAY[]::certification_type[],
  blocked_supplier_ids       uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  max_distance_km            int CHECK (max_distance_km IS NULL OR max_distance_km >= 0),
  -- Soft weights (0-100, normalized at read time — store user intent)
  price_weight               int NOT NULL DEFAULT 60 CHECK (price_weight BETWEEN 0 AND 100),
  quality_weight             int NOT NULL DEFAULT 30 CHECK (quality_weight BETWEEN 0 AND 100),
  delivery_weight            int NOT NULL DEFAULT 10 CHECK (delivery_weight BETWEEN 0 AND 100),
  prefer_bio                 boolean NOT NULL DEFAULT false,
  prefer_km0                 boolean NOT NULL DEFAULT false,
  preset_profile             preset_profile NOT NULL DEFAULT 'custom',
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_restaurant_preferences_restaurant_id ON restaurant_preferences(restaurant_id);

CREATE TABLE restaurant_category_preferences (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id              uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  macro_category             category_macro NOT NULL,
  min_quality_tier           quality_tier,
  lead_time_max_days         int CHECK (lead_time_max_days IS NULL OR lead_time_max_days >= 0),
  required_certifications    certification_type[] NOT NULL DEFAULT ARRAY[]::certification_type[],
  price_weight               int CHECK (price_weight IS NULL OR price_weight BETWEEN 0 AND 100),
  quality_weight             int CHECK (quality_weight IS NULL OR quality_weight BETWEEN 0 AND 100),
  delivery_weight            int CHECK (delivery_weight IS NULL OR delivery_weight BETWEEN 0 AND 100),
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, macro_category)
);

CREATE INDEX idx_restaurant_category_prefs_restaurant_id ON restaurant_category_preferences(restaurant_id);

-- Trigger: updated_at
CREATE OR REPLACE FUNCTION set_restaurant_preferences_updated_at()
RETURNS trigger AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_restaurant_preferences_updated_at
  BEFORE UPDATE ON restaurant_preferences
  FOR EACH ROW EXECUTE FUNCTION set_restaurant_preferences_updated_at();

CREATE TRIGGER trg_restaurant_category_preferences_updated_at
  BEFORE UPDATE ON restaurant_category_preferences
  FOR EACH ROW EXECUTE FUNCTION set_restaurant_preferences_updated_at();

-- RLS
ALTER TABLE restaurant_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_category_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant owner can manage own preferences"
  ON restaurant_preferences FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE profile_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE profile_id = auth.uid()));

CREATE POLICY "Restaurant owner can manage own category preferences"
  ON restaurant_category_preferences FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE profile_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE profile_id = auth.uid()));
