-- Phase 1D — DDT numbering RPC with pg_advisory_xact_lock
-- Refs: docs/superpowers/plans/2026-04-15-supplier-fase1d-ddt-consegne-dashboard.md (Task 7)
-- Purpose: serialized per-(supplier,year) next number allocation. Caller MUST invoke inside a
-- transaction because the advisory lock is transactional (pg_advisory_xact_lock releases at COMMIT/ROLLBACK).

CREATE OR REPLACE FUNCTION public.next_ddt_number(
  p_supplier_id uuid,
  p_year        int
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next int;
BEGIN
  IF p_supplier_id IS NULL OR p_year IS NULL THEN
    RAISE EXCEPTION 'supplier_id and year are required';
  END IF;

  -- Authorization: caller must have ddt.generate permission on this supplier.
  -- SECURITY DEFINER bypasses RLS, so we gate explicitly here.
  IF NOT public.has_supplier_permission(p_supplier_id, 'ddt.generate') THEN
    RAISE EXCEPTION 'forbidden: ddt.generate required for supplier %', p_supplier_id
      USING ERRCODE = '42501';
  END IF;

  -- Transaction-scoped advisory lock keyed on ('ddt:'||supplier||':'||year).
  PERFORM pg_advisory_xact_lock(hashtext('ddt:' || p_supplier_id::text || ':' || p_year::text));

  SELECT COALESCE(MAX(number), 0) + 1
    INTO v_next
    FROM public.ddt_documents
   WHERE supplier_id = p_supplier_id
     AND year        = p_year;

  RETURN v_next;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_ddt_number(uuid, int) TO authenticated;
