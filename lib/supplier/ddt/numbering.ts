import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Allocate the next DDT number for (supplier_id, year).
 *
 * Backed by the Postgres RPC `public.next_ddt_number` which:
 *  1. Validates the caller has `ddt.generate` on the supplier.
 *  2. Acquires `pg_advisory_xact_lock(hashtext('ddt:'||supplier||':'||year))`.
 *  3. Returns `COALESCE(MAX(number),0)+1` from `ddt_documents`.
 *
 * The advisory lock is transaction-scoped: the caller MUST insert the
 * corresponding `ddt_documents` row in the SAME transaction/RPC so that the
 * (supplier, year, number) unique index cannot race. In practice this means
 * wrapping both the number allocation AND the insert in a single server-side
 * RPC (see `generateDdtForDelivery` in Task 8). This helper is only safe when
 * invoked from such a wrapping RPC.
 */
export async function nextDdtNumber(
  client: SupabaseClient<Database>,
  supplierId: string,
  year: number,
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await (client as any).rpc("next_ddt_number", {
    p_supplier_id: supplierId,
    p_year: year,
  })) as { data: number | null; error: { message: string } | null };

  if (error) {
    throw new Error(`next_ddt_number failed: ${error.message}`);
  }
  if (data == null) {
    throw new Error("next_ddt_number returned null");
  }
  return Number(data);
}

export function currentDdtYear(reference: Date = new Date()): number {
  // Italian fiscal convention: civil year in Europe/Rome timezone.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
  });
  return Number(fmt.format(reference));
}
