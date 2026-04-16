"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const inputSchema = z.object({
  restaurantId: z.string().uuid({ message: "restaurantId non valido" }),
  amount: z
    .number()
    .nonnegative({ message: "Il budget non può essere negativo" })
    .nullable(),
});

export type UpdateMonthlyBudgetInput = z.infer<typeof inputSchema>;

export async function updateMonthlyBudget(
  input: UpdateMonthlyBudgetInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Input non valido" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non autenticato" };

  // RLS enforces that only the restaurant owner can update; we still verify
  // to return a clean error before hitting the DB.
  const { data: restaurant } = (await supabase
    .from("restaurants")
    .select("id, profile_id")
    .eq("id", parsed.data.restaurantId)
    .maybeSingle()) as { data: { id: string; profile_id: string } | null };

  if (!restaurant) return { ok: false, error: "Ristorante non trovato" };
  if (restaurant.profile_id !== user.id) {
    return { ok: false, error: "Non hai permesso di modificare questo ristorante" };
  }

  const { error } = await (supabase.from("restaurants") as unknown as {
    update: (patch: { monthly_budget_eur: number | null }) => {
      eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
    };
  })
    .update({ monthly_budget_eur: parsed.data.amount })
    .eq("id", parsed.data.restaurantId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/analytics");
  revalidatePath("/impostazioni/budget");
  return { ok: true };
}
