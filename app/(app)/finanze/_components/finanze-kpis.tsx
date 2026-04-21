"use client";

import { Euro, Percent, Receipt, Users } from "lucide-react";
import { KPICard } from "@/components/dashboard/cards/kpi-card";
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        label="Incasso 30gg"
        value={formatCentsCompact(revenueCents)}
        numericValue={Math.round(revenueCents / 100)}
        icon={Euro}
      />
      <KPICard
        label="Food cost %"
        value={formatPct(foodCostPct)}
        numericValue={foodCostPct ?? undefined}
        icon={Percent}
        accentColor={
          (foodCostPct ?? 0) > 35
            ? "var(--color-accent-orange)"
            : "var(--color-accent-green)"
        }
      />
      <KPICard
        label="Scontrini 30gg"
        value={receipts.toLocaleString("it-IT")}
        numericValue={receipts}
        icon={Receipt}
      />
      <KPICard
        label="Coperti 30gg"
        value={covers.toLocaleString("it-IT")}
        numericValue={covers}
        icon={Users}
      />
    </div>
  );
}
