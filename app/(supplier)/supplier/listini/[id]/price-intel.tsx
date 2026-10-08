"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarClock, TrendingUp } from "lucide-react";
import { CardEmpty, FCard, StatusPill } from "@/components/fernly/primitives";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { cancelScheduledPriceChange, schedulePriceChange } from "@/lib/supplier/pricing/scheduled-actions";

export type ScheduledChangeView = {
  id: string;
  categoryName: string | null;
  mode: "percent" | "fixed";
  value: number;
  effectiveDate: string;
  status: "scheduled" | "applied" | "canceled";
  note: string | null;
  notifiedAt: string | null;
  appliedCount: number | null;
};

function describe(c: { mode: "percent" | "fixed"; value: number }): string {
  if (c.mode === "percent") return `${c.value > 0 ? "+" : ""}${String(c.value).replace(".", ",")}%`;
  return `${c.value > 0 ? "+" : "−"}${formatCurrency(Math.abs(c.value))}`;
}

function tomorrowKey(): string {
  const d = new Date(Date.now() + 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(d);
}

export function ScheduledChangesCard({
  priceListId,
  categories,
  changes,
  canEdit,
  available,
}: {
  priceListId: string;
  categories: Array<{ id: string; name: string }>;
  changes: ScheduledChangeView[];
  canEdit: boolean;
  available: boolean;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [mode, setMode] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("");
  const [date, setDate] = useState(() => tomorrowKey());
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);

  function submit() {
    const v = Number(value.replace(",", "."));
    if (!Number.isFinite(v) || v === 0) return toast.error("Inserisci una variazione diversa da zero");
    start(async () => {
      const res = await schedulePriceChange({
        priceListId,
        categoryId: categoryId || null,
        mode,
        value: v,
        effectiveDate: date,
        note: note.trim() || null,
        notifyClients: notify,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.data.notified > 0
          ? `Variazione programmata e comunicata a ${res.data.notified} client${res.data.notified === 1 ? "e" : "i"}`
          : "Variazione programmata",
      );
      setOpen(false);
      setValue("");
      setNote("");
      router.refresh();
    });
  }

  async function cancel(id: string) {
    const ok = await confirm({ title: "Annullare la variazione programmata?", tone: "danger", confirmLabel: "Annulla variazione" });
    if (!ok) return;
    start(async () => {
      const res = await cancelScheduledPriceChange(id);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Variazione annullata");
        router.refresh();
      }
    });
  }

  return (
    <FCard
      className="mt-6"
      title={
        <span className="inline-flex items-center gap-2">
          <CalendarClock className="h-[18px] w-[18px] text-[var(--acc-700)]" aria-hidden /> Variazioni programmate
        </span>
      }
      action={
        canEdit && available && !open ? (
          <button type="button" className="f-btn f-btn-outline f-btn-sm" onClick={() => setOpen(true)}>
            Programma variazione
          </button>
        ) : null
      }
    >
      {dialog}
      {!available && (
        <p className="text-[12.5px] text-[var(--f-muted)]">
          Le variazioni con data di decorrenza si attivano dopo la migrazione del database (20261009000000).
        </p>
      )}
      {open && (
        <div className="mb-4 grid gap-3 rounded-[14px] bg-[var(--f-fill)] p-4 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="f-label">Prodotti</span>
            <select className="f-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Tutto il listino</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="f-label">Dal giorno</span>
            <input type="date" className="f-input" min={tomorrowKey()} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="f-label">Tipo</span>
            <select className="f-input" value={mode} onChange={(e) => setMode(e.target.value as "percent" | "fixed")}>
              <option value="percent">Percentuale (%)</option>
              <option value="fixed">Importo fisso (€ per unità)</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="f-label">Variazione (negativa per ribassi)</span>
            <input
              className="f-input"
              inputMode="decimal"
              placeholder={mode === "percent" ? "es. 3 o -2,5" : "es. 0,20"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          <label className="grid gap-1 sm:col-span-2">
            <span className="f-label">Motivazione per i clienti (facoltativa)</span>
            <input
              className="f-input"
              maxLength={300}
              placeholder="es. aumento costi di trasporto e materie prime"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-[13px] text-[var(--f-ink)] sm:col-span-2">
            <input type="checkbox" className="h-4 w-4 accent-[var(--acc-800)]" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            Avvisa subito i clienti del listino (messaggio + notifica)
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" className="f-btn f-btn-outline f-btn-sm" onClick={() => setOpen(false)}>
              Annulla
            </button>
            <button type="button" className="f-btn f-btn-primary f-btn-sm" onClick={submit} disabled={pending}>
              {pending ? "Salvo…" : "Programma"}
            </button>
          </div>
        </div>
      )}
      {changes.length === 0 ? (
        available && <CardEmpty>Nessuna variazione programmata. Comunica gli aumenti in anticipo: i clienti ricevono avviso e data.</CardEmpty>
      ) : (
        <ul className="divide-y divide-[var(--f-line)]">
          {changes.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-[var(--f-ink)]">
                  {describe(c)} · {c.categoryName ?? "tutto il listino"}
                </p>
                <p className="text-[12px] text-[var(--f-muted)]">
                  dal {formatDate(c.effectiveDate)}
                  {c.notifiedAt ? " · clienti avvisati" : ""}
                  {c.status === "applied" && c.appliedCount !== null ? ` · ${c.appliedCount} prezzi aggiornati` : ""}
                  {c.note ? ` · ${c.note}` : ""}
                </p>
              </div>
              <StatusPill tone={c.status === "scheduled" ? "warning" : c.status === "applied" ? "success" : "neutral"}>
                {c.status === "scheduled" ? "Programmata" : c.status === "applied" ? "Applicata" : "Annullata"}
              </StatusPill>
              {canEdit && c.status === "scheduled" && (
                <button type="button" className="f-btn f-btn-ghost f-btn-xs" onClick={() => cancel(c.id)} disabled={pending}>
                  Annulla
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </FCard>
  );
}

export type MarginRow = {
  itemId: string;
  productName: string;
  unitLabel: string;
  price: number;
  unitCost: number | null;
  marginPct: number | null;
  costBasis: "stock_medio" | "ultimo_carico" | null;
};

const LOW_MARGIN = 10;

export function MarginsCard({ rows }: { rows: MarginRow[] }) {
  const [showAll, setShowAll] = useState(false);
  const withCost = useMemo(
    () => rows.filter((r) => r.marginPct !== null).sort((a, b) => (a.marginPct ?? 0) - (b.marginPct ?? 0)),
    [rows],
  );
  const missing = rows.length - withCost.length;
  const low = withCost.filter((r) => (r.marginPct ?? 0) < LOW_MARGIN).length;
  const avg = withCost.length ? withCost.reduce((s, r) => s + (r.marginPct ?? 0), 0) / withCost.length : null;
  const shown = showAll ? withCost : withCost.slice(0, 12);

  return (
    <FCard
      className="mt-6"
      title={
        <span className="inline-flex items-center gap-2">
          <TrendingUp className="h-[18px] w-[18px] text-[var(--acc-700)]" aria-hidden /> Margini sul costo dei carichi
        </span>
      }
    >
      {withCost.length === 0 ? (
        <CardEmpty>
          Nessun costo registrato per i prodotti del listino. Il costo arriva dai carichi di magazzino (costo per unità
          base).
        </CardEmpty>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2 text-[12.5px]">
            {avg !== null && <StatusPill tone="info">Margine medio {avg.toFixed(1).replace(".", ",")}%</StatusPill>}
            {low > 0 && <StatusPill tone="danger">{low} sotto il {LOW_MARGIN}%</StatusPill>}
            {missing > 0 && <StatusPill tone="neutral">{missing} senza costo</StatusPill>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="text-[11px] uppercase tracking-[0.06em] text-[var(--f-muted)]">
                <tr className="border-b border-[var(--f-line)]">
                  <th className="py-2 pr-2 font-medium">Prodotto</th>
                  <th className="py-2 pr-2 text-right font-medium">Costo</th>
                  <th className="py-2 pr-2 text-right font-medium">Prezzo</th>
                  <th className="py-2 text-right font-medium">Margine</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.itemId} className="border-b border-[var(--f-line)] last:border-0">
                    <td className="py-2 pr-2">
                      <span className="text-[var(--f-ink)]">{r.productName}</span>
                      <span className="text-[var(--f-muted)]"> · {r.unitLabel}</span>
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums" title={r.costBasis === "ultimo_carico" ? "Ultimo carico (nessun lotto in giacenza)" : "Costo medio dei lotti in giacenza"}>
                      {r.unitCost !== null ? formatCurrency(r.unitCost) : "—"}
                      {r.costBasis === "ultimo_carico" ? "*" : ""}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{formatCurrency(r.price)}</td>
                    <td
                      className={`py-2 text-right font-medium tabular-nums ${
                        (r.marginPct ?? 0) < 0
                          ? "text-[var(--f-danger)]"
                          : (r.marginPct ?? 0) < LOW_MARGIN
                            ? "text-[var(--f-warning)]"
                            : "text-[var(--f-ink)]"
                      }`}
                    >
                      {r.marginPct !== null ? `${r.marginPct.toFixed(1).replace(".", ",")}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11.5px] text-[var(--f-muted)]">
              Ordinati dal margine più basso. * costo dell&apos;ultimo carico (nessun lotto in giacenza).
            </p>
            {withCost.length > 12 && (
              <button type="button" className="f-btn f-btn-ghost f-btn-xs" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Mostra meno" : `Mostra tutti (${withCost.length})`}
              </button>
            )}
          </div>
        </>
      )}
    </FCard>
  );
}
