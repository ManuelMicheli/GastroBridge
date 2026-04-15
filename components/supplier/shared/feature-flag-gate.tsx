import type { ReactNode } from "react";

/**
 * FeatureFlagGate — server component. Se `enabled` è `false`, renderizza
 * `fallback` (ad es. UI legacy o null) anziché i `children`.
 *
 * Usato per incanalare le nuove feature della Fase 1A dietro il flag
 * `suppliers.feature_flags.phase1_enabled`, così da poter rilasciare il
 * codice senza esporlo finché il fornitore non viene abilitato.
 */
export function FeatureFlagGate({
  enabled,
  children,
  fallback = null,
}: {
  enabled: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  if (!enabled) return <>{fallback}</>;
  return <>{children}</>;
}
