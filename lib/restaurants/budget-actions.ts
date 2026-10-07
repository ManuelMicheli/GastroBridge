"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { accessCan, getRestaurantAccess } from "@/lib/restaurants/context";

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

  // Owner, or a team member with settings.manage (RLS enforces the same once
  // 20261008000000_restaurant_team_rls.sql is applied); checked here to
  // return a clean error before hitting the DB.
  const access = await getRestaurantAccess(parsed.data.restaurantId);
  if (!access) return { ok: false, error: "Ristorante non trovato" };
  if (!accessCan(access, "settings.manage")) {
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
