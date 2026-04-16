import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BudgetForm } from "./budget-form";

export const metadata: Metadata = { title: "Budget mensile — Impostazioni" };
export const dynamic = "force-dynamic";

export default async function BudgetSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return <div className="p-6 text-sage">Devi accedere per gestire il budget.</div>;
  }

  const { data: restaurant } = (await supabase
    .from("restaurants")
    .select("id, name, monthly_budget_eur")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle()) as {
    data: { id: string; name: string; monthly_budget_eur: number | null } | null;
  };

  if (!restaurant) {
    return (
      <div className="p-6 text-sage">Nessun ristorante associato al tuo profilo.</div>
    );
  }

  return (
    <div>
      <Link
        href="/impostazioni"
        className="inline-flex items-center gap-1 text-sm text-sage hover:text-charcoal mb-4"
      >
        <ChevronLeft className="h-4 w-4" /> Impostazioni
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-charcoal">Budget mensile</h1>
        <p className="text-sage mt-1">
          Imposta un tetto di spesa mensile per ricevere avvisi quando stai
          superando il budget o rischi di sforarlo a fine mese.
        </p>
      </div>

      <BudgetForm
        restaurantId={restaurant.id}
        initialBudget={restaurant.monthly_budget_eur}
      />
    </div>
  );
}
