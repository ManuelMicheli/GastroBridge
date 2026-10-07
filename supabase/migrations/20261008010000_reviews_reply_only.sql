-- Reviews integrity: the supplier side may only write its reply.
--
-- The UPDATE policies on `reviews` ("Supplier can update review reply" for the
-- supplier owner, "reviews member reply" for staff with `reviews.reply`) are
-- row-level: they let the supplier side UPDATE the whole row, including the
-- ratings and comment written by the restaurant. RLS cannot restrict columns,
-- so this BEFORE UPDATE trigger does:
--
--   * service role / SQL without a JWT (auth.uid() IS NULL) → allowed;
--   * the owner of the review's restaurant                   → allowed;
--   * anyone else (i.e. the supplier side)                   → only
--     supplier_reply and supplier_replied_at may change; touching any other
--     column raises 42501 (insufficient_privilege).
--
-- SECURITY INVOKER is enough: the ownership lookup runs under the caller's RLS,
-- and the restaurant owner can always read their own restaurant row. A caller
-- who cannot see the restaurant row is, by construction, not its owner and gets
-- the restricted path.
--
-- Additive and idempotent: no policy is changed or dropped.

CREATE OR REPLACE FUNCTION public.reviews_enforce_reply_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Service role, cron jobs, migrations.
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- The restaurant that wrote the review keeps full control of its own row.
  IF OLD.restaurant_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM restaurants r
    WHERE r.id = OLD.restaurant_id
      AND r.profile_id = v_uid
  ) THEN
    RETURN NEW;
  END IF;

  -- Supplier side: reply columns only.
  IF NEW.id              IS DISTINCT FROM OLD.id
  OR NEW.rating          IS DISTINCT FROM OLD.rating
  OR NEW.quality_rating  IS DISTINCT FROM OLD.quality_rating
  OR NEW.delivery_rating IS DISTINCT FROM OLD.delivery_rating
  OR NEW.service_rating  IS DISTINCT FROM OLD.service_rating
  OR NEW.comment         IS DISTINCT FROM OLD.comment
  OR NEW.restaurant_id   IS DISTINCT FROM OLD.restaurant_id
  OR NEW.supplier_id     IS DISTINCT FROM OLD.supplier_id
  OR NEW.order_id        IS DISTINCT FROM OLD.order_id
  OR NEW.created_at      IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Il fornitore può modificare solo la risposta alla recensione'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.reviews_enforce_reply_only() IS
  'BEFORE UPDATE on reviews: non-owners of the restaurant (supplier side) may only change supplier_reply / supplier_replied_at.';

DROP TRIGGER IF EXISTS trigger_reviews_reply_only ON public.reviews;
CREATE TRIGGER trigger_reviews_reply_only
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.reviews_enforce_reply_only();
