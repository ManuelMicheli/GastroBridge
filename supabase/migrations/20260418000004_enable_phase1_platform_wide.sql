-- GastroBridge: enable Fase 1 platform-wide.
--
-- Il flag `suppliers.feature_flags.phase1_enabled` era pensato per un
-- rollout graduale per-fornitore. Non usiamo più il gating per-profilo:
-- la Fase 1 diventa il comportamento default per tutti.

ALTER TABLE suppliers
  ALTER COLUMN feature_flags SET DEFAULT '{"phase1_enabled": true}'::jsonb;

UPDATE suppliers
   SET feature_flags = COALESCE(feature_flags, '{}'::jsonb) || '{"phase1_enabled": true}'::jsonb
 WHERE feature_flags IS NULL
    OR (feature_flags->>'phase1_enabled') IS DISTINCT FROM 'true';
