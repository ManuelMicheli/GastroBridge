"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, ShoppingCart } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { StatusPill } from "@/components/fernly/primitives";
import { useCart } from "@/lib/hooks/useCart";
import { formatCurrency } from "@/lib/utils/formatters";
import { offerToCartItem } from "@/lib/restaurants/ordering/types";
import type { Alternative } from "@/lib/restaurants/ordering/prices";

export function AlternativesList({ alternatives, canOrder }: { alternatives: Alternative[]; canOrder: boolean }) {
  const router = useRouter();
  const { addItem } = useCart();
  return (
    <ul className="divide-y divide-[var(--f-line)]">
      {alternatives.slice(0, 30).map((a) => (
        <li key={a.key} className="flex flex-col gap-2 py-3 lg:flex-row lg:items-center lg:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-[var(--f-ink)]">{a.name}</p>
            <p className="text-[12px] text-[var(--f-muted)]">
              {a.supplierName} · {formatCurrency(a.currentUnitPrice)}/{a.measure}
            </p>
          </div>
          <ArrowRight className="hidden h-4 w-4 shrink-0 text-[var(--f-faint)] lg:block" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-[var(--f-ink)]">{a.alt.name}</p>
            <p className="text-[12px] text-[var(--f-muted)]">
              {a.alt.supplierName} · {formatCurrency(a.altUnitPrice)}/{a.measure} ({formatCurrency(a.alt.price)}/{a.alt.unit})
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="text-right">
              <StatusPill tone="success">−{Math.round(a.savingPct * 100)}%</StatusPill>
              <p className="mt-0.5 text-[12px] font-semibold tabular-nums text-[var(--f-success)]">
                {formatCurrency(a.monthlySaving)}/mese
              </p>
            </div>
            {canOrder && (
              <button
                type="button"
                className="f-btn f-btn-sm f-btn-outline"
                onClick={() => {
                  addItem(offerToCartItem(a.alt, Math.max(a.alt.minQuantity || 1, 1)));
                  toast.success(`${a.alt.name} aggiunto al carrello`, {
                    action: { label: "Carrello", onClick: () => router.push("/carrello") },
                  });
                }}
              >
                <ShoppingCart className="h-3.5 w-3.5" /> Prova
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
