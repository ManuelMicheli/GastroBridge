-- Staff invites create auth users through `auth.admin.inviteUserByEmail`,
-- which fires `handle_new_user`. That trigger provisions a brand-new
-- supplier/restaurant for every new user, and casts `role` to `user_role`:
--   * a staff role in the metadata (sales / warehouse / driver) made the
--     cast fail, so inviting a NEW user as non-admin staff always failed;
--   * `role = 'supplier'` would have created a second supplier owned by
--     the invitee.
--
-- Invited users carry `invited_supplier_id` (or `invited_restaurant_id`) in
-- their metadata: for them only the `profiles` row is created, with the
-- matching role and the inviting company's name; the membership row is
-- created by the app (lib/supplier/staff/actions.ts). Everything else is
-- unchanged from 20260418000003_auto_provision_on_signup.sql.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role          user_role;
  v_company_name  text;
BEGIN
  v_company_name := COALESCE(NEW.raw_user_meta_data->>'company_name', '');

  -- Team invite: profile only, no new company.
  IF NEW.raw_user_meta_data ? 'invited_supplier_id'
     OR NEW.raw_user_meta_data ? 'invited_restaurant_id' THEN
    v_role := CASE
      WHEN NEW.raw_user_meta_data ? 'invited_supplier_id' THEN 'supplier'::user_role
      ELSE 'restaurant'::user_role
    END;
    INSERT INTO public.profiles (id, role, company_name)
    VALUES (
      NEW.id,
      v_role,
      COALESCE(NULLIF(trim(v_company_name), ''), split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
  END IF;

  v_role := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'restaurant');

  INSERT INTO public.profiles (id, role, company_name)
  VALUES (NEW.id, v_role, v_company_name);

  IF v_role = 'supplier' THEN
    INSERT INTO public.suppliers (profile_id, company_name)
    VALUES (
      NEW.id,
      COALESCE(NULLIF(trim(v_company_name), ''), split_part(NEW.email, '@', 1), 'Fornitore')
    );
  ELSIF v_role = 'restaurant' THEN
    INSERT INTO public.restaurants (profile_id, name)
    VALUES (
      NEW.id,
      COALESCE(NULLIF(trim(v_company_name), ''), split_part(NEW.email, '@', 1), 'Ristorante')
    );
  END IF;

  RETURN NEW;
END;
$$;
