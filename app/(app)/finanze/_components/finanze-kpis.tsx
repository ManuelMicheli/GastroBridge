"use client";

import { TerminalKPICard } from "@/components/dashboard/cards/terminal-kpi-card";
import { formatCentsCompact, formatPct } from "@/lib/fiscal/format";

type Props = {
  revenueCents: number;
  foodCostPct: number | null;
  receipts: number;
  covers: number;
};

export function FinanzeKpis({
  revenueCents,
  foodCostPct,
  receipts,
  covers,
}: Props) {
  return (
    <section aria-label="KPI finanze">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
          KPI · Ultimi 30 giorni
        </span>
        <span aria-hidden className="h-px flex-1 bg-border-subtle" />
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] tabular-nums text-text-tertiary">
          {receipts > 0 ? `${receipts.toLocaleString("it-IT")} scontr.` : "—"}
        </span>
      </div>
      <div
        className="mt-3 grid gap-3"
        style={{
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
        }}
      >
        <TerminalKPICard
          index="01"
          label="Incasso 30gg"
          value={formatCentsCompact(revenueCents)}
          numericValue={Math.round(revenueCents / 100)}
          hint="POS collegati"
        />
        <TerminalKPICard
          index="02"
          label="Food cost %"
          value={formatPct(foodCostPct)}
          numericValue={foodCostPct ?? undefined}
          positiveIsGood={false}
          hint={
            foodCostPct === null
              ? "in attesa dati"
              : (foodCostPct ?? 0) > 35
                ? "sopra soglia"
                : "sotto soglia"
          }
        />
        <TerminalKPICard
          index="03"
          label="Scontrini 30gg"
          value={receipts.toLocaleString("it-IT")}
          numericValue={receipts}
          hint="ricevuti"
        />
        <TerminalKPICard
          index="04"
          label="Coperti 30gg"
          value={covers.toLocaleString("it-IT")}
          numericValue={covers}
          hint="serviti"
        />
      </div>
    </section>
  );
}
