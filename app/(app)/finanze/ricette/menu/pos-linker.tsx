"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { CardEmpty } from "@/components/fernly/primitives";
import { toast } from "@/components/ui/toast";
import { linkPosItem } from "@/lib/food-cost/actions";
import type { PosSaleRow } from "@/lib/food-cost/server/queries";
import { cn } from "@/lib/utils/formatters";

const eur = new Intl.NumberFormat("it-IT", { useGrouping: "always", style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const qty = new Intl.NumberFormat("it-IT", { useGrouping: "always", maximumFractionDigits: 1 });

/** Link POS menu items (by name) to recipes; suggested matches in one click. */
export function PosLinker({
  sales,
  recipes,
  suggestions,
  canWrite,
}: {
  sales: PosSaleRow[];
  recipes: Array<{ id: string; name: string }>;
  suggestions: Record<string, string>;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showAll, setShowAll] = useState(false);
  const pendingSuggestions = useMemo(() => sales.filter((s) => !s.linkedRecipeId && suggestions[s.name]), [sales, suggestions]);
  const recipeName = useMemo(() => new Map(recipes.map((r) => [r.id, r.name])), [recipes]);
  const rows = showAll ? sales : sales.slice(0, 25);

  if (recipes.length === 0) {
    return <CardEmpty>Crea prima le ricette dei piatti: poi le colleghi a quello che vendi in cassa.</CardEmpty>;
  }

  function link(posName: string, recipeId: string | null) {
    start(async () => {
      const res = await linkPosItem({ posName, recipeId, portionsPerSale: 1 });
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  function linkSuggested() {
    start(async () => {
      let ok = 0;
      for (const s of pendingSuggestions) {
        const res = await linkPosItem({ posName: s.name, recipeId: suggestions[s.name]!, portionsPerSale: 1 });
        if (res.ok) ok++;
      }
      toast.success(`${ok} piatti collegati`);
      router.refresh();
    });
  }

  return (
    <div>
      {canWrite && pendingSuggestions.length > 0 && (
        <div className="mb-3 flex flex-col gap-2 rounded-[14px] bg-[var(--acc-50)] p-3 sm:flex-row sm:items-center">
          <Sparkles className="h-5 w-5 shrink-0 text-[var(--acc-700)]" aria-hidden />
          <p className="min-w-0 flex-1 text-[13px] text-[var(--f-ink)]">
            {pendingSuggestions.length === 1 ? "1 piatto ha" : `${pendingSuggestions.length} piatti hanno`} un nome simile a una ricetta:{" "}
            {pendingSuggestions
              .slice(0, 3)
              .map((s) => `${s.name} → ${recipeName.get(suggestions[s.name]!)}`)
              .join(", ")}
            {pendingSuggestions.length > 3 ? "…" : ""}
          </p>
          <button type="button" className="f-btn f-btn-sm f-btn-primary shrink-0" onClick={linkSuggested} disabled={pending}>
            Collega i suggeriti
          </button>
        </div>
      )}
      <ul className="divide-y divide-[var(--f-line)]">
        {rows.map((s) => (
          <li key={s.key} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-[var(--f-ink)]">{s.name}</p>
              <p className="text-[12px] text-[var(--f-muted)]">
                {qty.format(s.qty)} venduti · {eur.format(s.netCents / 100)} netti
              </p>
            </div>
            <select
              className={cn("f-input !h-9 sm:!w-64", !s.linkedRecipeId && "text-[var(--f-muted)]")}
              value={s.linkedRecipeId ?? ""}
              disabled={!canWrite || pending}
              onChange={(e) => link(s.name, e.target.value || null)}
              aria-label={`Ricetta per ${s.name}`}
            >
              <option value="">{suggestions[s.name] ? `Suggerito: ${recipeName.get(suggestions[s.name]!)}` : "Non collegato"}</option>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      {sales.length > 25 && (
        <button type="button" className="mt-2 text-[13px] font-medium text-[var(--acc-ink)] hover:underline" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Mostra meno" : `Mostra tutti (${sales.length})`}
        </button>
      )}
    </div>
  );
}
