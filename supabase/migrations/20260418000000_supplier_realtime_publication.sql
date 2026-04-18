-- Enable realtime publication for tables consumed by the supplier live workflow.
-- order_splits, partnership_messages are already added in earlier migrations.
-- in_app_notifications is the canonical fan-out row used by the supplier provider.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'in_app_notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.in_app_notifications';
  END IF;
END
$$;
