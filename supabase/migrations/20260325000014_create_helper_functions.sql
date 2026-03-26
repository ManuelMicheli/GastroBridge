-- GastroBridge: Helper functions for RLS and common operations

-- Get the current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user owns a supplier
CREATE OR REPLACE FUNCTION is_supplier_owner(p_supplier_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM suppliers
    WHERE id = p_supplier_id AND profile_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user owns a restaurant
CREATE OR REPLACE FUNCTION is_restaurant_owner(p_restaurant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM restaurants
    WHERE id = p_restaurant_id AND profile_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Calculate order total from items
CREATE OR REPLACE FUNCTION calculate_order_total(p_order_id UUID)
RETURNS DECIMAL(10,2) AS $$
  SELECT COALESCE(SUM(subtotal), 0)
  FROM order_items
  WHERE order_id = p_order_id;
$$ LANGUAGE sql STABLE;

-- Enable Supabase Realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_splits;
