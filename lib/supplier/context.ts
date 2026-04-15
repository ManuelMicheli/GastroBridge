"use server";

import { createClient } from "@/lib/supabase/server";
import type { SupplierPermission } from "@/types/database";

export async function getActiveSupplierMember(supplierId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("supplier_members")
    .select("id, role, supplier_id")
    .eq("supplier_id", supplierId)
    .eq("profile_id", user.id)
    .eq("is_active", true)
    .not("accepted_at", "is", null)
    .maybeSingle();
  return data;
}

export async function requireSupplierMember(supplierId: string) {
  const m = await getActiveSupplierMember(supplierId);
  if (!m) throw new Error("Non sei membro di questo fornitore");
  return m;
}

export async function requirePermission(
  supplierId: string,
  permission: SupplierPermission,
): Promise<void> {
  const supabase = await createClient();
  // Cast via unknown: il tipo generato di Database non espone la shape GenericSchema
  // attesa da supabase-js per `rpc`, per cui gli Args vengono inferiti come `undefined`.
  // La firma della RPC è comunque garantita da `types/database.ts`.
  const { data } = await (
    supabase.rpc as unknown as (
      fn: "has_supplier_permission",
      args: { p_supplier_id: string; p_permission: string },
    ) => Promise<{ data: boolean | null; error: unknown }>
  )("has_supplier_permission", {
    p_supplier_id: supplierId,
    p_permission: permission,
  });
  if (!data) throw new Error(`Permesso mancante: ${permission}`);
}
