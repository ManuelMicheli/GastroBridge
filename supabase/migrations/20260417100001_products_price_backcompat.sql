-- Backward-compat: keep products.price in sync with the default price list
-- item for the product's base sales unit, so legacy restaurant-side code
-- that reads products.price keeps working.

CREATE OR REPLACE FUNCTION sync_products_price_from_default_list()
RETURNS trigger AS $$
DECLARE
  v_price numeric;
BEGIN
  -- price from the default price list for the product's base sales_unit
  SELECT pli.price INTO v_price
    FROM price_list_items pli
    JOIN price_lists pl ON pl.id = pli.price_list_id AND pl.is_default = true
    JOIN product_sales_units psu ON psu.id = pli.sales_unit_id AND psu.is_base = true
   WHERE pli.product_id = NEW.product_id
   LIMIT 1;

  IF v_price IS NOT NULL THEN
    UPDATE products SET price = v_price WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_products_price ON price_list_items;

CREATE TRIGGER trg_sync_products_price
  AFTER INSERT OR UPDATE OF price ON price_list_items
  FOR EACH ROW EXECUTE FUNCTION sync_products_price_from_default_list();
