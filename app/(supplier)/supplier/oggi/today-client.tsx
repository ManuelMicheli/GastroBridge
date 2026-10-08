"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCheck, Clock3 } from "lucide-react";
import { CardEmpty, StatusPill } from "@/components/fernly/primitives";
import { bulkAcceptSplits } from "@/lib/supplier/orders/bulk-actions";
import type { PendingOrder } from "@/lib/supplier/intel/today";
import type { NextCutoff } from "@/lib/supplier/intel/time";
import { COVERAGE_LABEL, COVERAGE_TONE } from "@/lib/supplier/intel/coverage";
import { CREDIT_FLAG_LABEL } from "@/lib/supplier/intel/credit";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { useConfirm } from "@/components/ui/confirm-dialog";

/* ------------------------------------------------------------------ */
/* Cut-off countdown                                                    */
/* ------------------------------------------------------------------ */

function useNow(intervalMs = 1000): number | null {
  // null on the server and first client render → no hydration mismatch.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function formatLeft(ms: number): string {
  if (ms <= 0) return "chiuso";
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 24) return `${Math.floor(h / 24)} g ${h % 24} h`;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m} min ${String(s).padStart(2, "0")} s`;
}

export function CutoffStrip({ cutoffs }: { cutoffs: NextCutoff[] }) {
  const now = useNow(1000);
  const shown = cutoffs.slice(0, 4);
  return (
    <section
      aria-label="Cut-off ordini"
      className="f-card f-rise mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3.5"
      style={{ ["--i" as string]: 0 }}
    >
      <span className="inline-flex items-center gap-2 text-[13px] font-medium text-[var(--f-ink)]">
        <Clock3 className="h-4 w-4 text-[var(--acc-700)]" aria-hidden /> Cut-off ordini
      </span>
      {shown.map((c) => {
        const left = now === null ? null : Date.parse(c.cutoffAt) - now;
        const urgent = left !== null && left < 2 * 3_600_000;
        return (
          <span key={c.zoneId} className="inline-flex items-baseline gap-2 text-[12.5px] text-[var(--f-muted)]">
            <span className="font-medium text-[var(--f-ink-2)]">{c.zoneName}</span>
            <span>
              entro le {c.cutoffTime} per {formatDate(c.deliveryDate)}
            </span>
            <span
              className={`tabular-nums font-semibold ${urgent ? "text-[var(--f-danger)]" : "text-[var(--acc-800)]"}`}
              suppressHydrationWarning
            >
              {left === null ? "—" : formatLeft(left)}
            </span>
          </span>
        );
      })}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Pending intake with bulk accept                                      */
/* ------------------------------------------------------------------ */

export function PendingIntake({ orders }: { orders: PendingOrder[] }) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [isPending, startTransition] = useTransition();

  // Pre-select only what will certainly go through: stock covered (or not
  // managed) and no credit block.
  const defaultSelected = useMemo(
    () =>
      new Set(
        orders
          .filter((o) => (o.coverage === "covered" || o.coverage === "untracked") && o.credit?.flag !== "hold" && o.credit?.flag !== "over")
          .map((o) => o.splitId),
      ),
    [orders],
  );
  const [selected, setSelected] = useState<Set<string>>(defaultSelected);
  useEffect(() => setSelected(defaultSelected), [defaultSelected]);

  if (orders.length === 0) {
    return <CardEmpty>Nessun ordine in attesa di conferma.</CardEmpty>;
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectedOrders = orders.filter((o) => selected.has(o.splitId));
  const selectedValue = selectedOrders.reduce((s, o) => s + o.subtotal, 0);

  async function acceptSelected() {
    if (selectedOrders.length === 0) return;
    const risky = selectedOrders.filter(
      (o) => o.coverage === "partial" || o.coverage === "uncovered" || o.credit?.flag === "hold" || o.credit?.flag === "over",
    );
    const ok = await confirm({
      title: `Accettare ${selectedOrders.length} ordin${selectedOrders.length === 1 ? "e" : "i"}?`,
      description: (
        <span>
          Tutte le righe verranno accettate e lo stock prenotato (FEFO). Valore {formatCurrency(selectedValue)}.
          {risky.length > 0 && (
            <>
              <br />
              <strong>
                {risky.length} ordin{risky.length === 1 ? "e ha" : "i hanno"} stock scoperto o fido da verificare: in caso
                di stock insufficiente l&apos;ordine resta in &quot;Conflitto stock&quot;.
              </strong>
            </>
          )}
        </span>
      ),
      confirmLabel: "Accetta",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await bulkAcceptSplits(selectedOrders.map((o) => o.splitId));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const confirmed = res.data.filter((r) => r.result === "confirmed").length;
      const conflicts = res.data.filter((r) => r.result === "stock_conflict").length;
      const errors = res.data.filter((r) => r.result === "error");
      if (confirmed) toast.success(`${confirmed} ordin${confirmed === 1 ? "e confermato" : "i confermati"}`);
      if (conflicts) toast.warning(`${conflicts} in conflitto stock: aprili per modificare le righe`);
      if (errors.length) toast.error(errors[0]?.message ?? "Alcuni ordini non sono stati accettati");
      router.refresh();
    });
  }

  return (
    <div>
      {dialog}
      <ul className="divide-y divide-[var(--f-line)]">
        {orders.slice(0, 30).map((o) => {
          const checked = selected.has(o.splitId);
          return (
            <li key={o.splitId} className="flex items-center gap-3 py-2.5">
              <input
                type="checkbox"
                className="h-[18px] w-[18px] shrink-0 accent-[var(--acc-800)]"
                checked={checked}
                onChange={() => toggle(o.splitId)}
                aria-label={`Seleziona ordine di ${o.restaurantName}`}
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/supplier/ordini/${o.splitId}`}
                  className="block truncate text-[14px] font-medium text-[var(--f-ink)] hover:underline"
                >
                  {o.restaurantName}
                </Link>
                <p className="text-[12px] text-[var(--f-muted)] tabular-nums">
                  {o.lineCount} righe · {formatCurrency(o.subtotal)} · da {o.ageHours < 1 ? "<1" : Math.round(o.ageHours)} h
                  {o.expectedDeliveryDate ? ` · consegna ${formatDate(o.expectedDeliveryDate)}` : ""}
                </p>
              </div>
              <div className="hidden flex-wrap justify-end gap-1.5 sm:flex">
                {o.credit && (
                  <StatusPill tone={o.credit.flag === "near" ? "warning" : "danger"}>
                    {CREDIT_FLAG_LABEL[o.credit.flag]}
                  </StatusPill>
                )}
                <StatusPill tone={COVERAGE_TONE[o.coverage]}>
                  {o.coverage === "partial" || o.coverage === "uncovered"
                    ? `${o.shortLines} righe scoperte`
                    : COVERAGE_LABEL[o.coverage]}
                </StatusPill>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12.5px] text-[var(--f-muted)]">
          Preselezionati solo gli ordini con stock coperto e fido in regola.
        </p>
        <button
          type="button"
          className="f-btn f-btn-primary f-btn-sm"
          disabled={selectedOrders.length === 0 || isPending}
          onClick={acceptSelected}
        >
          <CheckCheck className="h-4 w-4" aria-hidden />
          {isPending ? "Accetto…" : `Accetta selezionati (${selectedOrders.length})`}
        </button>
      </div>
    </div>
  );
}
