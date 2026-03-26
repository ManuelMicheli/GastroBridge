-- GastroBridge: Seed Data
-- Categories and Subcategories for Ho.Re.Ca. marketplace

-- ==========================================
-- CATEGORIES
-- ==========================================
INSERT INTO categories (id, name, slug, icon, sort_order) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Food Fresco', 'food-fresco', 'Salad', 1),
  ('c1000000-0000-0000-0000-000000000002', 'Food Secco', 'food-secco', 'Package', 2),
  ('c1000000-0000-0000-0000-000000000003', 'Bevande', 'bevande', 'Wine', 3),
  ('c1000000-0000-0000-0000-000000000004', 'Surgelati', 'surgelati', 'Snowflake', 4),
  ('c1000000-0000-0000-0000-000000000005', 'Packaging', 'packaging', 'Box', 5),
  ('c1000000-0000-0000-0000-000000000006', 'Cleaning', 'cleaning', 'SprayBottle', 6),
  ('c1000000-0000-0000-0000-000000000007', 'Attrezzature', 'attrezzature', 'Wrench', 7);

-- ==========================================
-- SUBCATEGORIES
-- ==========================================

-- Food Fresco
INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Frutta', 'frutta', 1),
  ('c1000000-0000-0000-0000-000000000001', 'Verdura', 'verdura', 2),
  ('c1000000-0000-0000-0000-000000000001', 'Carne', 'carne', 3),
  ('c1000000-0000-0000-0000-000000000001', 'Pesce', 'pesce', 4),
  ('c1000000-0000-0000-0000-000000000001', 'Latticini', 'latticini', 5),
  ('c1000000-0000-0000-0000-000000000001', 'Salumi', 'salumi', 6),
  ('c1000000-0000-0000-0000-000000000001', 'Uova', 'uova', 7),
  ('c1000000-0000-0000-0000-000000000001', 'Pane e Panetteria', 'pane-panetteria', 8);

-- Food Secco
INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES
  ('c1000000-0000-0000-0000-000000000002', 'Pasta', 'pasta', 1),
  ('c1000000-0000-0000-0000-000000000002', 'Riso e Cereali', 'riso-cereali', 2),
  ('c1000000-0000-0000-0000-000000000002', 'Farina', 'farina', 3),
  ('c1000000-0000-0000-0000-000000000002', 'Olio e Aceto', 'olio-aceto', 4),
  ('c1000000-0000-0000-0000-000000000002', 'Conserve', 'conserve', 5),
  ('c1000000-0000-0000-0000-000000000002', 'Spezie e Condimenti', 'spezie-condimenti', 6),
  ('c1000000-0000-0000-0000-000000000002', 'Dolci e Dessert', 'dolci-dessert', 7);

-- Bevande
INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES
  ('c1000000-0000-0000-0000-000000000003', 'Vino', 'vino', 1),
  ('c1000000-0000-0000-0000-000000000003', 'Birra', 'birra', 2),
  ('c1000000-0000-0000-0000-000000000003', 'Liquori e Spirits', 'liquori-spirits', 3),
  ('c1000000-0000-0000-0000-000000000003', 'Acqua', 'acqua', 4),
  ('c1000000-0000-0000-0000-000000000003', 'Bibite e Succhi', 'bibite-succhi', 5),
  ('c1000000-0000-0000-0000-000000000003', 'Caffè e Tè', 'caffe-te', 6);

-- Surgelati
INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES
  ('c1000000-0000-0000-0000-000000000004', 'Pesce Surgelato', 'pesce-surgelato', 1),
  ('c1000000-0000-0000-0000-000000000004', 'Verdure Surgelate', 'verdure-surgelate', 2),
  ('c1000000-0000-0000-0000-000000000004', 'Impasti e Basi', 'impasti-basi', 3),
  ('c1000000-0000-0000-0000-000000000004', 'Gelati', 'gelati', 4);

-- Packaging
INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES
  ('c1000000-0000-0000-0000-000000000005', 'Contenitori Asporto', 'contenitori-asporto', 1),
  ('c1000000-0000-0000-0000-000000000005', 'Sacchetti e Buste', 'sacchetti-buste', 2),
  ('c1000000-0000-0000-0000-000000000005', 'Pellicola e Alluminio', 'pellicola-alluminio', 3),
  ('c1000000-0000-0000-0000-000000000005', 'Tovaglioli e Carta', 'tovaglioli-carta', 4);

-- Cleaning
INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES
  ('c1000000-0000-0000-0000-000000000006', 'Detergenti', 'detergenti', 1),
  ('c1000000-0000-0000-0000-000000000006', 'Igienizzanti', 'igienizzanti', 2),
  ('c1000000-0000-0000-0000-000000000006', 'Guanti e DPI', 'guanti-dpi', 3);

-- Attrezzature
INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES
  ('c1000000-0000-0000-0000-000000000007', 'Pentole e Padelle', 'pentole-padelle', 1),
  ('c1000000-0000-0000-0000-000000000007', 'Coltelleria', 'coltelleria', 2),
  ('c1000000-0000-0000-0000-000000000007', 'Piccoli Elettrodomestici', 'piccoli-elettrodomestici', 3),
  ('c1000000-0000-0000-0000-000000000007', 'Piatti e Posate', 'piatti-posate', 4);
