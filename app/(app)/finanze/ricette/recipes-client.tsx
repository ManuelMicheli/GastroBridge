"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, TrendingUp, X } from "lucide-react";
import { Chips } from "@/components/fernly/chips";
import { CardEmpty, FCard, StatusPill } from "@/components/fernly/primitives";
import { toast } from "@/components/ui/toast";
import { dismissFoodCostAlert } from "@/lib/food-cost/actions";
import type { FoodCostAlertRow, RecipeListItem } from "@/lib/food-cost/server/queries";
import { cn } from "@/lib/utils/formatters";

const eur = new Intl.NumberFormat("it-IT", { useGrouping: "always", style: "currency", currency: "EUR" });
const pct = (n: number | null) => (n === null ? "—" : `${n.toFixed(1).replace(".", ",")}%`);

type Tab = "dish" | "base" | "over";

export function RecipesClient({ items, alerts, canWrite }: { items: RecipeListItem[]; alerts: FoodCostAlertRow[]; canWrite: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const over = items.filter((i) => i.overTarget).length;
  const [tab, setTab] = useState<Tab>(items.some((i) => i.kind === "dish") ? "dish" : "base");
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items
      .filter((i) => (tab === "over" ? i.overTarget : i.kind === tab))
      .filter((i) => !needle || `${i.name} ${i.category ?? ""}`.toLowerCase().includes(needle))
      .sort((a, b) => (tab === "over" ? (b.foodCostPct ?? 0) - b.targetPct - ((a.foodCostPct ?? 0) - a.targetPct) : a.name.localeCompare(b.name, "it")));
  }, [items, tab, q]);

  function dismiss(id: string) {
    start(async () => {
      const res = await dismissFoodCostAlert(id);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <FCard index={4} title="Ricette">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Chips
            value={tab}
            onChange={setTab}
            ariaLabel="Tipo di ricetta"
            options={[
              { value: "dish", label: "Piatti", count: items.filter((i) => i.kind === "dish").length },
              { value: "base", label: "Semilavorati", count: items.filter((i) => i.kind === "base").length },
              ...(over > 0 ? [{ value: "over" as const, label: "Sopra obiettivo", count: over }] : []),
            ]}
          />
          <input className="f-input sm:!w-56 sm:ml-auto" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca" aria-label="Cerca ricetta" />
        </div>
        {shown.length === 0 ? (
          <CardEmpty>{tab === "base" ? "Nessun semilavorato (sughi, impasti, fondi…)." : "Nessuna ricetta qui."}</CardEmpty>
        ) : (
          <ul className="divide-y divide-[var(--f-line)]">
            {shown.map((r) => (
              <li key={r.id}>
                <Link href={`/finanze/ricette/${r.id}`} className="-mx-2 flex items-center gap-3 rounded-[12px] px-2 py-3 transition-colors hover:bg-[var(--f-fill)]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-[var(--f-ink)]">{r.name}</p>
                    <p className="truncate text-[12px] text-[var(--f-muted)]">
                      {r.category ? `${r.category} · ` : ""}
                      {r.ingredientsCount} ingredienti
                      {r.missingCount > 0 ? ` · ${r.missingCount} senza prezzo` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[14px] font-semibold tabular-nums text-[var(--f-ink)]">
                      {eur.format(r.costPerPortion)}
                      <span className="text-[11.5px] font-normal text-[var(--f-muted)]">{r.kind === "dish" ? "/porz." : ""}</span>
                    </p>
                    {r.kind === "dish" && r.salePrice !== null && (
                      <p className="text-[12px] tabular-nums text-[var(--f-muted)]">prezzo {eur.format(r.salePrice)}</p>
                    )}
                  </div>
                  {r.kind === "dish" && (
                    <div className="w-[84px] shrink-0 text-right">
                      <StatusPill tone={r.foodCostPct === null ? "neutral" : r.overTarget ? "danger" : "success"}>{pct(r.foodCostPct)}</StatusPill>
                      {r.margin !== null && <p className="mt-0.5 text-[11.5px] tabular-nums text-[var(--f-muted)]">+{eur.format(r.margin)}</p>}
                    </div>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--f-faint)]" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </FCard>

      <FCard index={5} title="Avvisi">
        {alerts.length === 0 ? (
          <CardEmpty>Nessun piatto ha superato l&apos;obiettivo per un aumento di prezzo.</CardEmpty>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li key={a.id} className={cn("flex items-start gap-2.5 rounded-[14px] bg-[var(--f-danger-bg)] p-3 text-[13px]", pending && "opacity-70")}>
                <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-[var(--f-danger)]" aria-hidden />
                <Link href={`/finanze/ricette/${a.recipe_id}`} className="min-w-0 flex-1 text-[var(--f-ink)] hover:underline">
                  {a.message}
                </Link>
                {canWrite && (
                  <button type="button" className="shrink-0 text-[var(--f-muted)] hover:text-[var(--f-ink)]" onClick={() => dismiss(a.id)} aria-label="Archivia avviso">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </FCard>
    </div>
  );
}
