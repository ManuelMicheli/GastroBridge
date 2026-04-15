-- Plan 1C Task 4 — In-app notifications table
-- Stores in-app notifications routed by the dispatcher.
-- Recipient is a profile (auth.users → profiles.id).

CREATE TABLE IF NOT EXISTS public.in_app_notifications (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_profile_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type            notification_event NOT NULL,
  title                 text NOT NULL,
  body                  text NULL,
  link                  text NULL,
  metadata              jsonb NULL,
  read_at               timestamptz NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_in_app_notifications_recipient_created
  ON public.in_app_notifications (recipient_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_in_app_notifications_recipient_unread
  ON public.in_app_notifications (recipient_profile_id)
  WHERE read_at IS NULL;

ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;

-- Select: only the recipient can read their own notifications
DO $$ BEGIN
  CREATE POLICY in_app_notifications_select_own
    ON public.in_app_notifications
    FOR SELECT
    USING (recipient_profile_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Update: only the recipient can mark their own notifications as read
DO $$ BEGIN
  CREATE POLICY in_app_notifications_update_own
    ON public.in_app_notifications
    FOR UPDATE
    USING (recipient_profile_id = auth.uid())
    WITH CHECK (recipient_profile_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Insert: no policy for authenticated (dispatcher uses service role).
-- This effectively restricts inserts to service_role, which is desired.
