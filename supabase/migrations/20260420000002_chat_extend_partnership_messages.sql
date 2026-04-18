-- Extend partnership_messages to support:
--   * per-order scoped threads (order_split_id — NULL = global pair thread)
--   * attachment-only messages (body becomes nullable; at least one of body/attachments)
ALTER TABLE public.partnership_messages
  ADD COLUMN IF NOT EXISTS order_split_id uuid NULL REFERENCES public.order_splits(id) ON DELETE SET NULL;

ALTER TABLE public.partnership_messages
  ALTER COLUMN body DROP NOT NULL;

ALTER TABLE public.partnership_messages
  DROP CONSTRAINT IF EXISTS partnership_messages_body_or_attachments;

ALTER TABLE public.partnership_messages
  ADD CONSTRAINT partnership_messages_body_or_attachments
  CHECK (
    (body IS NOT NULL AND char_length(body) > 0)
    OR attachments IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_pm_order_split
  ON public.partnership_messages (order_split_id)
  WHERE order_split_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pm_rel_created
  ON public.partnership_messages (relationship_id, created_at DESC);
