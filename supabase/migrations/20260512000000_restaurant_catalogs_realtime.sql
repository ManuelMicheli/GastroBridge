-- Enable realtime publication for restaurant_catalogs so the restaurant
-- dashboard can react instantly when the user imports a new manual supplier.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'restaurant_catalogs'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_catalogs';
  END IF;
END
$$;
