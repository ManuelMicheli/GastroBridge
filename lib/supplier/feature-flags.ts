import type { Database } from "@/types/database";

type SupplierRow = Database["public"]["Tables"]["suppliers"]["Row"];

/**
 * @deprecated Fase 1 è stata completamente rilasciata (Plan 1D Task 14,
 * 2026-04-15). `phase1_enabled` è ora considerato sempre `true` per ogni
 * supplier. La funzione è mantenuta per compatibilità con i call-site
 * esistenti (sidebar, pagine DDT/staff) ma sarà rimossa in Fase 2 insieme
 * ai wrapper `<FeatureFlagGate>` residui.
 *
 * La colonna `suppliers.feature_flags` resta in DB per futuri flag.
 */
export function isPhase1Enabled(
  _supplier: Pick<SupplierRow, "feature_flags"> | null | undefined,
): boolean {
  return true;
}
