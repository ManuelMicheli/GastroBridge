-- GastroBridge: smart import memory.
--
-- Stores what the import engine learns from the user's corrections (product
-- name / unit / category fixes, abbreviations, column layouts, confirmed
-- supplier details) so the next import of the same supplier's list is
-- recognised automatically.
--
--   * restaurant side: one row per (restaurant, supplier key) where the key is
--     'catalog:<uuid>', 'piva:<11 digits>' or 'name:<normalized name>'
--   * supplier side:   one row per (supplier, 'self')
--
-- Additive only: new table, indexes and policies. Policies are created only
-- when missing (no DROP statements), so the migration can be re-run safely.

CREATE TABLE IF NOT EXISTS public.import_memory (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid        NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  supplier_id   uuid        NULL REFERENCES public.suppliers(id)   ON DELETE CASCADE,
  source_key    text        NOT NULL CHECK (char_length(source_key) BETWEEN 1 AND 200),
  hints         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  uses          integer     NOT NULL DEFAULT 0 CHECK (uses >= 0),
  updated_by    uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT import_memory_one_owner CHECK ((restaurant_id IS NULL) <> (supplier_id IS NULL)),
  CONSTRAINT import_memory_hints_object CHECK (jsonb_typeof(hints) = 'object'),
  CONSTRAINT import_memory_hints_size CHECK (pg_column_size(hints) <= 2097152),
  -- exactly one owner column is NULL, so NULLS NOT DISTINCT gives one row per
  -- (owner, key) and lets PostgREST upsert with on_conflict on these columns.
  CONSTRAINT import_memory_owner_key UNIQUE NULLS NOT DISTINCT (restaurant_id, supplier_id, source_key)
);

CREATE INDEX IF NOT EXISTS idx_import_memory_restaurant ON public.import_memory (restaurant_id) WHERE restaurant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_import_memory_supplier   ON public.import_memory (supplier_id)   WHERE supplier_id   IS NOT NULL;

ALTER TABLE public.import_memory ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Restaurant: team members read, partnership.manage writes (same rule as
  -- restaurant_catalogs); owners always (fallback when the team tables are empty).
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'import_memory' AND policyname = 'import_memory restaurant read'
  ) THEN
    CREATE POLICY "import_memory restaurant read"
      ON public.import_memory FOR SELECT
      USING (
        restaurant_id IS NOT NULL AND (
          private.is_restaurant_member(restaurant_id)
          OR restaurant_id IN (SELECT r.id FROM public.restaurants r WHERE r.profile_id = auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'import_memory' AND policyname = 'import_memory restaurant manage'
  ) THEN
    CREATE POLICY "import_memory restaurant manage"
      ON public.import_memory FOR ALL
      USING (
        restaurant_id IS NOT NULL AND (
          private.has_restaurant_permission(restaurant_id, 'partnership.manage')
          OR restaurant_id IN (SELECT r.id FROM public.restaurants r WHERE r.profile_id = auth.uid())
        )
      )
      WITH CHECK (
        restaurant_id IS NOT NULL AND (
          private.has_restaurant_permission(restaurant_id, 'partnership.manage')
          OR restaurant_id IN (SELECT r.id FROM public.restaurants r WHERE r.profile_id = auth.uid())
        )
      );
  END IF;

  -- Supplier: catalog.read reads, catalog.edit writes.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'import_memory' AND policyname = 'import_memory supplier read'
  ) THEN
    CREATE POLICY "import_memory supplier read"
      ON public.import_memory FOR SELECT
      USING (supplier_id IS NOT NULL AND public.has_supplier_permission(supplier_id, 'catalog.read'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'import_memory' AND policyname = 'import_memory supplier manage'
  ) THEN
    CREATE POLICY "import_memory supplier manage"
      ON public.import_memory FOR ALL
      USING (supplier_id IS NOT NULL AND public.has_supplier_permission(supplier_id, 'catalog.edit'))
      WITH CHECK (supplier_id IS NOT NULL AND public.has_supplier_permission(supplier_id, 'catalog.edit'));
  END IF;
END
$$;

COMMENT ON TABLE public.import_memory IS
  'Smart import: corrections learned per restaurant/supplier source (product hints, abbreviations, column layouts, supplier details).';
