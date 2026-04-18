-- Per-profile "last time I entered this sidebar section" marker.
-- Used to suppress the sidebar badge once the user has seen the section,
-- until new items arrive after that timestamp.
CREATE TABLE IF NOT EXISTS public.nav_section_seen (
  profile_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section        text        NOT NULL CHECK (char_length(section) BETWEEN 1 AND 60),
  last_seen_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, section)
);

ALTER TABLE public.nav_section_seen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nav_section_seen own" ON public.nav_section_seen;
CREATE POLICY "nav_section_seen own"
  ON public.nav_section_seen FOR ALL
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
