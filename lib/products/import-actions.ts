/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

export type ProductImportRow = {
  name: string;
  unit: string;
  price: number;
  brand?: string | null;
  description?: string | null;
  origin?: string | null;
  min_quantity?: number | null;
};

const UNIT_ENUM = ["kg", "g", "lt", "ml", "pz", "cartone", "bottiglia", "latta", "confezione"] as const;

const RowSchema = z.object({
  name:         z.string().min(1).max(200),
  unit:         z.enum(UNIT_ENUM),
  price:        z.number().positive().max(1_000_000),
  brand:        z.string().max(100).nullish(),
  description:  z.string().max(1000).nullish(),
  origin:       z.string().max(200).nullish(),
  min_quantity: z.number().positive().nullish(),
});

export type ImportOptions = {
  categoryId: string;
  skipDuplicates: boolean;
};

export async function importSupplierProducts(
  rows: ProductImportRow[],
  opts: ImportOptions,
): Promise<Result<{ inserted: number; skipped: number }>> {
  if (rows.length === 0) return { ok: false, error: "Nessuna riga da importare" };
  if (!opts.categoryId) return { ok: false, error: "Categoria di default richiesta" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non autenticato" };

  // Multi-tenant: prova prima supplier_members (Fase 1), poi legacy owner.
  const { data: member } = await supabase
    .from("supplier_members")
    .select("supplier_id, role")
    .eq("profile_id", user.id)
    .eq("is_active", true)
    .not("accepted_at", "is", null)
    .limit(1)
    .maybeSingle<{ supplier_id: string; role: string }>();

  let supplierId = member?.supplier_id ?? null;

  if (!supplierId) {
    const { data: owned } = await supabase
      .from("suppliers")
      .select("id")
      .eq("profile_id", user.id)
      .limit(1)
      .maybeSingle<{ id: string }>();
    supplierId = owned?.id ?? null;
  }

  if (!supplierId) return { ok: false, error: "Profilo fornitore non trovato" };

  // Permesso catalog.edit: admin e sales.
  if (member && !["admin", "sales"].includes(member.role)) {
    return { ok: false, error: "Non hai i permessi per modificare il catalogo" };
  }

  // Validate all rows up-front.
  const validated: ProductImportRow[] = [];
  for (const r of rows) {
    const parsed = RowSchema.safeParse(r);
    if (!parsed.success) {
      return { ok: false, error: `Riga "${r.name || "?"}" non valida: ${parsed.error.issues[0]?.message}` };
    }
    validated.push(parsed.data);
  }

  let toInsert = validated;
  let skipped = 0;

  if (opts.skipDuplicates) {
    const { data: existing } = await supabase
      .from("products")
      .select("name")
      .eq("supplier_id", supplierId)
      .returns<Array<{ name: string }>>();
    const taken = new Set((existing ?? []).map((p) => p.name.trim().toLowerCase()));
    toInsert = validated.filter((r) => {
      const key = r.name.trim().toLowerCase();
      if (taken.has(key)) { skipped += 1; return false; }
      taken.add(key);
      return true;
    });
  }

  if (toInsert.length === 0) {
    return { ok: true, data: { inserted: 0, skipped } };
  }

  const CHUNK = 500;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const slice = toInsert.slice(i, i + CHUNK).map((r) => ({
      supplier_id:  supplierId,
      category_id:  opts.categoryId,
      name:         r.name,
      brand:        r.brand ?? null,
      description:  r.description ?? null,
      unit:         r.unit,
      price:        r.price,
      min_quantity: r.min_quantity ?? 1,
      origin:       r.origin ?? null,
    }));
    const { error } = await (supabase as any).from("products").insert(slice);
    if (error) {
      console.error("[importSupplierProducts] insert failed", {
        supplierId,
        categoryId: opts.categoryId,
        sliceSize: slice.length,
        firstRow: slice[0],
        error,
      });
      return { ok: false, error: `${error.code ?? ""} ${error.message}${error.details ? " — " + error.details : ""}`.trim() };
    }
  }

  revalidatePath("/supplier/catalogo");
  return { ok: true, data: { inserted: toInsert.length, skipped } };
}
