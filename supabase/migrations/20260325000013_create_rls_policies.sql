-- GastroBridge: Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_orders ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- PROFILES: Users can read/update their own profile
-- ==========================================
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ==========================================
-- RESTAURANTS: Owner can CRUD, suppliers can view connected restaurants
-- ==========================================
CREATE POLICY "Restaurant owner can manage own restaurants"
  ON restaurants FOR ALL
  USING (profile_id = auth.uid());

CREATE POLICY "Suppliers can view restaurants that ordered from them"
  ON restaurants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN order_splits os ON os.order_id = o.id
      JOIN suppliers s ON os.supplier_id = s.id
      WHERE o.restaurant_id = restaurants.id
        AND s.profile_id = auth.uid()
    )
  );

-- ==========================================
-- SUPPLIERS: Public read for active, owner can manage
-- ==========================================
CREATE POLICY "Anyone can view active suppliers"
  ON suppliers FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Supplier owner can manage own supplier"
  ON suppliers FOR ALL
  USING (profile_id = auth.uid());

-- ==========================================
-- CATEGORIES & SUBCATEGORIES: Public read
-- ==========================================
CREATE POLICY "Anyone can view categories"
  ON categories FOR SELECT
  USING (TRUE);

CREATE POLICY "Anyone can view subcategories"
  ON subcategories FOR SELECT
  USING (TRUE);

-- ==========================================
-- PRODUCTS: Public read for available, supplier owner can manage
-- ==========================================
CREATE POLICY "Anyone can view available products"
  ON products FOR SELECT
  USING (is_available = TRUE);

CREATE POLICY "Supplier can view all own products"
  ON products FOR SELECT
  USING (
    supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
  );

CREATE POLICY "Supplier can insert own products"
  ON products FOR INSERT
  WITH CHECK (
    supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
  );

CREATE POLICY "Supplier can update own products"
  ON products FOR UPDATE
  USING (
    supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
  )
  WITH CHECK (
    supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
  );

CREATE POLICY "Supplier can delete own products"
  ON products FOR DELETE
  USING (
    supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
  );

-- ==========================================
-- ORDERS: Restaurant owner can manage
-- ==========================================
CREATE POLICY "Restaurant owner can view own orders"
  ON orders FOR SELECT
  USING (
    restaurant_id IN (SELECT id FROM restaurants WHERE profile_id = auth.uid())
  );

CREATE POLICY "Restaurant owner can create orders"
  ON orders FOR INSERT
  WITH CHECK (
    restaurant_id IN (SELECT id FROM restaurants WHERE profile_id = auth.uid())
  );

CREATE POLICY "Restaurant owner can update own orders"
  ON orders FOR UPDATE
  USING (
    restaurant_id IN (SELECT id FROM restaurants WHERE profile_id = auth.uid())
  );

-- ==========================================
-- ORDER ITEMS: Restaurant owner can manage
-- ==========================================
CREATE POLICY "Restaurant owner can manage order items"
  ON order_items FOR ALL
  USING (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN restaurants r ON o.restaurant_id = r.id
      WHERE r.profile_id = auth.uid()
    )
  );

CREATE POLICY "Supplier can view their order items"
  ON order_items FOR SELECT
  USING (
    supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
  );

-- ==========================================
-- ORDER SPLITS: Restaurant owner can view, supplier can view/update theirs
-- ==========================================
CREATE POLICY "Restaurant owner can view order splits"
  ON order_splits FOR SELECT
  USING (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN restaurants r ON o.restaurant_id = r.id
      WHERE r.profile_id = auth.uid()
    )
  );

CREATE POLICY "Restaurant owner can create order splits"
  ON order_splits FOR INSERT
  WITH CHECK (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN restaurants r ON o.restaurant_id = r.id
      WHERE r.profile_id = auth.uid()
    )
  );

CREATE POLICY "Supplier can view own order splits"
  ON order_splits FOR SELECT
  USING (
    supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
  );

CREATE POLICY "Supplier can update own order splits"
  ON order_splits FOR UPDATE
  USING (
    supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
  )
  WITH CHECK (
    supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
  );

-- ==========================================
-- REVIEWS: Public read, restaurant owner can create
-- ==========================================
CREATE POLICY "Anyone can view reviews"
  ON reviews FOR SELECT
  USING (TRUE);

CREATE POLICY "Restaurant owner can create reviews"
  ON reviews FOR INSERT
  WITH CHECK (
    restaurant_id IN (SELECT id FROM restaurants WHERE profile_id = auth.uid())
  );

CREATE POLICY "Supplier can update review reply"
  ON reviews FOR UPDATE
  USING (
    supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
  )
  WITH CHECK (
    supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
  );

-- ==========================================
-- SUBSCRIPTIONS: Own profile only
-- ==========================================
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Users can manage own subscription"
  ON subscriptions FOR ALL
  USING (profile_id = auth.uid());

-- ==========================================
-- PRICE HISTORY: Public read
-- ==========================================
CREATE POLICY "Anyone can view price history"
  ON price_history FOR SELECT
  USING (TRUE);

-- ==========================================
-- DELIVERY ZONES: Public read, supplier owner can manage
-- ==========================================
CREATE POLICY "Anyone can view delivery zones"
  ON delivery_zones FOR SELECT
  USING (TRUE);

CREATE POLICY "Supplier can manage own delivery zones"
  ON delivery_zones FOR ALL
  USING (
    supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
  );

-- ==========================================
-- SAVED ORDERS: Restaurant owner only
-- ==========================================
CREATE POLICY "Restaurant owner can manage saved orders"
  ON saved_orders FOR ALL
  USING (
    restaurant_id IN (SELECT id FROM restaurants WHERE profile_id = auth.uid())
  );
