import type { Database } from "@/types/database";

type SupplierRow = Database["public"]["Tables"]["suppliers"]["Row"];

export function isPhase1Enabled(
  supplier: Pick<SupplierRow, "feature_flags"> | null | undefined,
): boolean {
  if (!supplier?.feature_flags) return false;
  const flags = supplier.feature_flags as Record<string, unknown>;
  return flags.phase1_enabled === true;
}
