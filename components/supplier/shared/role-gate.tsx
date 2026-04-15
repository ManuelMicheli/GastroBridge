import type { ReactNode } from "react";
import type { SupplierRole } from "@/types/database";

/**
 * RoleGate — mostra i `children` solo se il ruolo corrente del membro fornitore
 * è incluso in `allowed`. Altrimenti renderizza `fallback` (default: null).
 *
 * Nota: è un gate esclusivamente UI. L'autorità su permessi resta RLS +
 * `has_supplier_permission` lato server. Usalo per nascondere CTA/route
 * inaccessibili prima del round-trip.
 */
export function RoleGate({
  currentRole,
  allowed,
  children,
  fallback = null,
}: {
  currentRole: SupplierRole | null;
  allowed: SupplierRole[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  if (!currentRole || !allowed.includes(currentRole)) return <>{fallback}</>;
  return <>{children}</>;
}
