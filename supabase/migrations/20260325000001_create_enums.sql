-- GastroBridge: Custom ENUM types
CREATE TYPE user_role AS ENUM ('restaurant', 'supplier', 'admin');

CREATE TYPE cuisine_type AS ENUM (
  'italiana', 'pizzeria', 'pesce', 'carne', 'giapponese',
  'fusion', 'bistrot', 'trattoria', 'gourmet', 'altro'
);

CREATE TYPE unit_type AS ENUM (
  'kg', 'g', 'lt', 'ml', 'pz',
  'cartone', 'bottiglia', 'latta', 'confezione'
);

CREATE TYPE order_status AS ENUM (
  'draft', 'submitted', 'confirmed', 'preparing',
  'shipping', 'delivered', 'cancelled'
);

CREATE TYPE plan_type AS ENUM (
  'free', 'pro', 'business',
  'base', 'growth', 'enterprise'
);
