"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { updateMonthlyBudget } from "@/lib/restaurants/budget-actions";

type Props = {
  restaurantId: string;
  initialBudget: number | null;
};

export function BudgetForm({ restaurantId, initialBudget }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState<boolean>(initialBudget !== null);
  const [amount, setAmount] = useState<string>(
    initialBudget !== null ? String(initialBudget) : "5000",
  );
  const [pending, startTransition] = useTransition();

  function handleSave() {
    let nextAmount: number | null;
    if (!enabled) {
      nextAmount = null;
    } else {
      const parsed = parseFloat(amount);
      if (Number.isNaN(parsed) || parsed < 0) {
        toast("Importo non valido");
        return;
      }
      nextAmount = parsed;
    }

    startTransition(async () => {
      const res = await updateMonthlyBudget({ restaurantId, amount: nextAmount });
      if (res.ok) {
        toast(enabled ? "Budget aggiornato" : "Budget disattivato");
        router.refresh();
      } else {
        toast(`Errore: ${res.error}`);
      }
    });
  }

  return (
    <Card>
      <div className="space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="mt-1"
          />
          <div>
            <span className="font-semibold text-charcoal">Attiva budget mensile</span>
            <p className="text-xs text-sage mt-0.5">
              Quando attivo, la pagina Analytics mostrerà una barra di progresso
              e avvisi se superi o rischi di superare il budget.
            </p>
          </div>
        </label>

        <div className={enabled ? "" : "opacity-50 pointer-events-none"}>
          <label className="block text-sm font-semibold text-charcoal mb-2">
            Importo budget (EUR)
          </label>
          <div className="flex items-center gap-2 max-w-xs">
            <Input
              type="number"
              min={0}
              step={50}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!enabled || pending}
            />
            <span className="text-sage">€ / mese</span>
          </div>
          <p className="text-xs text-sage mt-2">
            Il budget si riferisce al mese solare corrente. Per periodi diversi
            (ultimi 3 mesi, anno…) la barra progresso resta ancorata al mese in corso.
          </p>
        </div>

        <div className="pt-2">
          <Button onClick={handleSave} disabled={pending}>
            {pending ? "Salvataggio…" : "Salva budget"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
