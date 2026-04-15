-- Plan 1D Task 14 (2026-04-15): chiusura Fase 1.
--
-- `phase1_enabled` diventa il default per tutti i supplier esistenti e futuri.
-- Il gating UI/server è stato rimosso (`isPhase1Enabled` ritorna sempre true),
-- questa migration tiene il DB allineato al nuovo contratto a livello di dati.
-- La colonna `feature_flags` rimane per futuri flag di Fase 2+.

-- Hygiene backfill (idempotente): imposta phase1_enabled=true su ogni riga,
-- preservando eventuali altri flag già presenti in feature_flags.
UPDATE public.suppliers
SET feature_flags = COALESCE(feature_flags, '{}'::jsonb)
                    || jsonb_build_object('phase1_enabled', true)
WHERE feature_flags IS NULL
   OR NOT (feature_flags ? 'phase1_enabled')
   OR (feature_flags->>'phase1_enabled') <> 'true';

-- Nuovo default a livello di colonna: ogni nuovo supplier nasce con
-- phase1_enabled=true. Mantiene formato jsonb per compatibilità.
ALTER TABLE public.suppliers
  ALTER COLUMN feature_flags
  SET DEFAULT jsonb_build_object('phase1_enabled', true);
