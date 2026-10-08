"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { upsertCustomerTerms } from "@/lib/supplier/intel/credit-actions";
import { CREDIT_FLAG_LABEL, type CreditSnapshot } from "@/lib/supplier/intel/credit";
import { StatusPill } from "@/components/fernly/primitives";
import { formatCurrency } from "@/lib/utils/formatters";

export function CreditTermsEditor({
  restaurantId,
  snapshot,
  canEdit,
  available,
}: {
  restaurantId: string;
  snapshot: CreditSnapshot | null;
  canEdit: boolean;
  available: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [limit, setLimit] = useState(snapshot?.creditLimit?.toString() ?? "");
  const [terms, setTerms] = useState(snapshot?.paymentTermsDays?.toString() ?? "");
  const [hold, setHold] = useState(snapshot?.creditHold ?? false);
  const [notes, setNotes] = useState(snapshot?.notes ?? "");
  const [pending, start] = useTransition();

  const util = snapshot?.utilization ?? null;
  const tone =
    snapshot?.flag === "ok" ? "success" : snapshot?.flag === "near" ? "warning" : snapshot?.flag === "none" ? "neutral" : "danger";

  function save() {
    const creditLimit = limit.trim() === "" ? null : Number(limit.replace(",", "."));
    const paymentTermsDays = terms.trim() === "" ? null : Number(terms);
    if (creditLimit !== null && !(creditLimit >= 0)) return toast.error("Fido non valido");
    if (paymentTermsDays !== null && !(Number.isInteger(paymentTermsDays) && paymentTermsDays >= 0)) {
      return toast.error("Giorni di pagamento non validi");
    }
    start(async () => {
      const res = await upsertCustomerTerms({
        restaurantId,
        creditLimit,
        paymentTermsDays,
        creditHold: hold,
        notes: notes.trim() || null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Condizioni salvate");
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div>
      {snapshot && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={tone}>{CREDIT_FLAG_LABEL[snapshot.flag]}</StatusPill>
            <span className="text-[12px] text-[var(--f-muted)]">pagamento a {snapshot.paymentTermsDays} gg</span>
          </div>
          <p className="mt-3 text-[26px] font-medium tabular-nums text-[var(--f-ink)]">
            {formatCurrency(snapshot.exposure)}
            {snapshot.creditLimit !== null && (
              <span className="text-[14px] text-[var(--f-muted)]"> / {formatCurrency(snapshot.creditLimit)}</span>
            )}
          </p>
          <p className="text-[12px] text-[var(--f-muted)]">
            Esposizione stimata: {formatCurrency(snapshot.openValue)} in ordini aperti + {formatCurrency(snapshot.deliveredNotDue)} consegnati
            non ancora scaduti
          </p>
          {util !== null && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--f-fill-2)]" aria-hidden>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, util * 100)}%`,
                  background: util >= 1 ? "var(--f-danger)" : util >= 0.85 ? "var(--f-warning)" : "var(--acc-600)",
                }}
              />
            </div>
          )}
          {snapshot.notes && <p className="mt-2 text-[12.5px] italic text-[var(--f-ink-2)]">{snapshot.notes}</p>}
        </>
      )}

      {!available && (
        <p className="mt-3 text-[12px] text-[var(--f-muted)]">
          Fido e blocco clienti si attivano dopo la migrazione del database (20261009000000).
        </p>
      )}

      {canEdit && available && !editing && (
        <button type="button" className="f-btn f-btn-outline f-btn-sm mt-4" onClick={() => setEditing(true)}>
          Imposta fido e termini
        </button>
      )}

      {editing && (
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1">
            <span className="f-label">Fido (€) — vuoto = nessun limite</span>
            <input className="f-input" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="f-label">Pagamento a giorni — vuoto = standard fornitore</span>
            <input className="f-input" inputMode="numeric" value={terms} onChange={(e) => setTerms(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-[13px] text-[var(--f-ink)]">
            <input type="checkbox" checked={hold} onChange={(e) => setHold(e.target.checked)} className="h-4 w-4 accent-[var(--acc-800)]" />
            Cliente bloccato (es. insoluti): avvisa prima di accettare ordini
          </label>
          <label className="grid gap-1">
            <span className="f-label">Nota amministrativa</span>
            <input className="f-input" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="f-btn f-btn-outline f-btn-sm" onClick={() => setEditing(false)}>
              Annulla
            </button>
            <button type="button" className="f-btn f-btn-primary f-btn-sm" onClick={save} disabled={pending}>
              {pending ? "Salvo…" : "Salva"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
