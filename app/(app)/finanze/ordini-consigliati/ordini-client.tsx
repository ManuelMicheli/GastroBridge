"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Check, X, RotateCw } from "lucide-react";
import {
  dismissSuggestion,
  actSuggestion,
  regenerateSuggestions,
  type ReorderSuggestionRow,
} from "@/lib/fiscal/reorder";
import { formatCents } from "@/lib/fiscal/format";

type Props = {
  restaurantId: string;
  suggestions: ReorderSuggestionRow[];
};

const URGENCY_META: Record<
  ReorderSuggestionRow["urgency"],
  { label: string; className: string; dot: string }
> = {
  critical: {
    label: "Critico",
    className:
      "bg-accent-orange/15 text-accent-orange border-accent-orange/40",
    dot: "bg-accent-orange animate-pulse",
  },
  high: {
    label: "Alto",
    className: "bg-amber-500/10 text-amber-500 border-amber-500/30",
    dot: "bg-amber-500",
  },
  medium: {
    label: "Medio",
    className:
      "bg-accent-green/10 text-accent-green border-accent-green/30",
    dot: "bg-accent-green",
  },
  low: {
    label: "Basso",
    className: "bg-text-tertiary/10 text-text-tertiary border-border-subtle",
    dot: "bg-text-tertiary",
  },
};

function snapshotField<T>(snapshot: Record<string, unknown>, key: string): T | null {
  return key in snapshot ? (snapshot[key] as T) : null;
}

export function OrdiniConsigliatiClient({ restaurantId, suggestions }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  if (suggestions.length === 0) {
    return (
      <div className="space-y-6">
        {error && <ErrorBanner message={error} />}
        <div className="bg-surface-card border border-border-subtle rounded-2xl p-10 text-center">
          <p className="text-sm text-text-secondary mb-4">
            Nessun ordine consigliato al momento.
          </p>
          <button
            type="button"
            onClick={() => run(regenerateSuggestions)}
            disabled={pending}
            className="inline-flex items-center gap-2 bg-accent-green text-surface-base text-sm font-medium rounded-lg px-4 py-2 hover:bg-accent-green/90 disabled:opacity-50"
          >
            <RotateCw className="h-4 w-4" />
            Rigenera ora
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <div className="flex items-center justify-between">
        <p className="text-xs text-text-tertiary">
          {suggestions.length} consigli aperti · basati su depletion 30gg
        </p>
        <button
          type="button"
          onClick={() => run(regenerateSuggestions)}
          disabled={pending}
          className="inline-flex items-center gap-2 text-xs text-accent-green hover:underline"
        >
          <RotateCw className="h-3 w-3" />
          Rigenera
        </button>
      </div>

      <ul className="space-y-3">
        {suggestions.map((s) => {
          const meta = URGENCY_META[s.urgency];
          const remainingCents =
            snapshotField<number>(s.snapshot, "remaining_cents") ?? null;
          const avgBurn =
            snapshotField<number>(s.snapshot, "avg_daily_burn_cents") ?? null;
          return (
            <li
              key={s.id}
              className="bg-surface-card border border-border-subtle rounded-2xl p-5 lg:p-6"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold rounded-full border px-2 py-0.5 ${meta.className}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${meta.dot}`}
                        aria-hidden
                      />
                      {meta.label}
                    </span>
                    {s.estimated_coverage_days !== null && (
                      <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
                        Copertura {s.estimated_coverage_days}gg
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-text-primary">
                    {s.category_name ?? s.product_name ?? "Categoria"}
                  </h3>
                  <p className="text-xs text-text-secondary mt-1">{s.reason}</p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    <Stat
                      label="Qt. suggerita"
                      value={
                        s.suggested_qty !== null
                          ? `${s.suggested_qty.toFixed(2)}${s.suggested_unit ? ` ${s.suggested_unit}` : ""}`
                          : "—"
                      }
                    />
                    <Stat
                      label="Residuo stimato"
                      value={
                        remainingCents !== null
                          ? formatCents(remainingCents)
                          : "—"
                      }
                    />
                    <Stat
                      label="Consumo/gg"
                      value={avgBurn !== null ? formatCents(avgBurn) : "—"}
                    />
                    <Stat
                      label="Fornitore"
                      value={s.supplier_name ?? "—"}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <Link
                    href={`/cerca?r=${restaurantId}&category=${s.category_id ?? ""}${s.preferred_supplier_id ? `&supplier=${s.preferred_supplier_id}` : ""}`}
                    onClick={() => run(() => actSuggestion(s.id))}
                    className="inline-flex items-center gap-2 bg-accent-green text-surface-base text-sm font-medium rounded-lg px-4 py-2 hover:bg-accent-green/90"
                  >
                    <Check className="h-4 w-4" />
                    Ordina
                  </Link>
                  <button
                    type="button"
                    onClick={() => run(() => dismissSuggestion(s.id))}
                    disabled={pending}
                    className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary rounded-lg px-4 py-2 border border-border-subtle"
                  >
                    <X className="h-4 w-4" />
                    Ignora
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-text-tertiary mb-0.5">
        {label}
      </p>
      <p className="text-sm font-mono text-text-primary">{value}</p>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 bg-accent-orange/10 border border-accent-orange/30 rounded-xl px-4 py-3 text-sm text-accent-orange">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
      <p>{message}</p>
    </div>
  );
}
