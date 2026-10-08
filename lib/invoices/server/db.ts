// lib/invoices/server/db.ts
// Loose Supabase client type used by the finance server modules. The
// hand-rolled types/database.ts does not know the new tables yet (no codegen
// in this repo), so queries go through `Db` like lib/fiscal/actions.ts.

import "server-only";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = any;

export type QueryResult<T> = { data: T | null; error: { message: string; code?: string } | null };

/** Run a select and return rows, or [] on error (logged). */
export async function rows<T>(q: PromiseLike<QueryResult<T[]>>, label: string): Promise<T[]> {
  const { data, error } = await q;
  if (error) {
    console.error(`[finance] ${label}: ${error.message}`);
    return [];
  }
  return data ?? [];
}

/** Split an array in chunks (PostgREST `in()` lists must stay short). */
export function chunks<T>(arr: T[], size = 150): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

export const toCents = (eur: number | null | undefined) => Math.round((eur ?? 0) * 100);
