-- GastroBridge: estende la policy RLS restaurants per consentire al fornitore
-- di vedere il ristoratore che ha inviato una richiesta `pending`.
-- Senza questa policy la UI /supplier/clienti riceve restaurant=null per le
-- richieste in attesa → il supplier non vede chi lo ha invitato.
--
-- Usa SECURITY DEFINER helper per evitare ricorsione RLS tra restaurants
-- e restaurant_suppliers (vedi 20260415000001_fix_restaurants_rls_recursion).

DROP POLICY IF EXISTS "Suppliers can view restaurants with active partnership" ON restaurants;
DROP POLICY IF EXISTS "Suppliers can view restaurants with partnership" ON restaurants;

CREATE OR REPLACE FUNCTION supplier_has_partnership_with_restaurant(
  _restaurant_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM restaurant_suppliers rs
    JOIN suppliers s ON s.id = rs.supplier_id
    WHERE rs.restaurant_id = _restaurant_id
      AND s.profile_id = _user_id
      AND rs.status IN ('pending', 'active', 'paused')
  );
$$;

CREATE POLICY "Suppliers can view restaurants with partnership"
  ON restaurants FOR SELECT
  USING (supplier_has_partnership_with_restaurant(restaurants.id, auth.uid()));
