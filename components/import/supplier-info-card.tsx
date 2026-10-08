"use client";

import { BadgeCheck, Building2, CalendarClock, MessageCircle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils/formatters";
import { DAY_LABELS, isValidPartitaIva } from "@/lib/import/parse/supplier-info";
import type { FieldConfidence } from "@/lib/import/types";

export type SupplierForm = {
  name: string;
  vatNumber: string;
  phones: string;
  emails: string;
  address: string;
  deliveryDays: number[];
  /** "HH:MM" or "" */
  orderCutoff: string;
  minOrder: string;
  leadTimeDays: string;
  notes: string;
  /** Also save days / cut-off as the supplier's delivery schedule (Consegne). */
  saveSchedule: boolean;
  /** Also save phone / e-mail as the contact used to send orders. */
  saveContact: boolean;
};

function Hint({ c }: { c?: FieldConfidence }) {
  if (!c) return null;
  return (
    <span className={cn("mt-1 block text-[11.5px]", c.score >= 0.8 ? "text-[var(--f-faint)]" : "text-[var(--f-warning)]")}>
      {c.reason}
    </span>
  );
}

/** Editable card with what we understood about the supplier. */
export function SupplierInfoCard({
  value,
  onChange,
  confidence,
}: {
  value: SupplierForm;
  onChange: (next: SupplierForm) => void;
  confidence: Partial<Record<string, FieldConfidence>>;
}) {
  const set = (patch: Partial<SupplierForm>) => onChange({ ...value, ...patch });
  const vat = value.vatNumber.replace(/\D/g, "");
  const vatState = !vat ? null : vat.length === 11 && isValidPartitaIva(vat) ? "ok" : "bad";

  return (
    <section className="f-card p-5 sm:px-[22px]" aria-label="Dati del fornitore">
      <header className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--acc-50)] text-[var(--acc-700)]">
          <Building2 className="h-5 w-5" />
        </span>
        <div>
          <h2 className="f-card-title">Fornitore</h2>
          <p className="text-[12.5px] text-[var(--f-muted)]">Quello che abbiamo capito dal documento: correggi se serve.</p>
        </div>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="f-label">Nome / ragione sociale *</span>
          <input className="f-input mt-1" value={value.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} placeholder="Es. Rossi Ortofrutta" />
          <Hint c={confidence.name} />
        </label>
        <label className="block">
          <span className="f-label">Partita IVA</span>
          <div className="relative">
            <input className="f-input mt-1 pr-9 tabular-nums" value={value.vatNumber} inputMode="numeric" maxLength={13} onChange={(e) => set({ vatNumber: e.target.value })} />
            {vatState === "ok" ? <BadgeCheck className="absolute right-3 top-1/2 h-4 w-4 -translate-y-[35%] text-[var(--f-success)]" aria-label="P.IVA valida" /> : null}
            {vatState === "bad" ? <ShieldAlert className="absolute right-3 top-1/2 h-4 w-4 -translate-y-[35%] text-[var(--f-danger)]" aria-label="P.IVA non valida" /> : null}
          </div>
          {vatState === "bad" ? <span className="mt-1 block text-[11.5px] text-[var(--f-danger)]">Il codice di controllo non torna: verifica le cifre.</span> : <Hint c={confidence.vatNumber} />}
        </label>
        <label className="block">
          <span className="f-label">Telefono</span>
          <input className="f-input mt-1" value={value.phones} onChange={(e) => set({ phones: e.target.value })} />
        </label>
        <label className="block">
          <span className="f-label">E-mail</span>
          <input className="f-input mt-1" value={value.emails} onChange={(e) => set({ emails: e.target.value })} />
        </label>
        <label className="block">
          <span className="f-label">Indirizzo</span>
          <input className="f-input mt-1" value={value.address} onChange={(e) => set({ address: e.target.value })} />
        </label>
        <fieldset className="sm:col-span-2">
          <legend className="f-label">Giorni di consegna</legend>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => {
              const on = value.deliveryDays.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ deliveryDays: on ? value.deliveryDays.filter((x) => x !== d) : [...value.deliveryDays, d].sort() })}
                  className={cn(
                    "h-9 min-w-[48px] rounded-full border px-3 text-[13px] font-medium transition-colors",
                    on
                      ? "border-transparent bg-[var(--acc-800)] text-white"
                      : "border-[var(--f-line)] bg-[var(--f-card)] text-[var(--f-ink-2)] hover:bg-[var(--f-fill)]",
                  )}
                >
                  {DAY_LABELS[d]}
                </button>
              );
            })}
          </div>
          <Hint c={confidence.deliveryDays} />
        </fieldset>
        <label className="block">
          <span className="f-label">Ordini entro le (orario limite)</span>
          <input
            type="time"
            className="f-input mt-1 tabular-nums"
            value={value.orderCutoff}
            onChange={(e) => set({ orderCutoff: e.target.value })}
            aria-describedby="cutoff-hint"
          />
          <span id="cutoff-hint" className="mt-1 block text-[11.5px] text-[var(--f-faint)]">
            {value.orderCutoff ? "Ti ricordiamo di ordinare prima di quest’ora" : "Non indicato nel documento"}
          </span>
        </label>
        <label className="block">
          <span className="f-label">Ordine minimo (€)</span>
          <input className="f-input mt-1 tabular-nums" inputMode="decimal" value={value.minOrder} onChange={(e) => set({ minOrder: e.target.value })} />
          <Hint c={confidence.minOrder} />
        </label>
        <label className="block">
          <span className="f-label">Tempi di consegna (giorni)</span>
          <input className="f-input mt-1 tabular-nums" inputMode="numeric" value={value.leadTimeDays} onChange={(e) => set({ leadTimeDays: e.target.value })} />
          <Hint c={confidence.leadTimeDays} />
        </label>
        <label className="block sm:col-span-2">
          <span className="f-label">Note (contatti, orari, condizioni)</span>
          <textarea className="f-input mt-1 min-h-[72px] py-2.5" maxLength={500} value={value.notes} onChange={(e) => set({ notes: e.target.value })} style={{ height: "auto" }} />
        </label>
        <div className="flex flex-col gap-2 rounded-xl bg-[var(--f-fill)] p-3 sm:col-span-2">
          <label className="flex items-start gap-2 text-[13px] text-[var(--f-ink-2)]">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[var(--acc-700)]"
              checked={value.saveSchedule}
              disabled={value.deliveryDays.length === 0 && !value.orderCutoff}
              onChange={(e) => set({ saveSchedule: e.target.checked })}
            />
            <span>
              <span className="inline-flex items-center gap-1.5 font-medium text-[var(--f-ink)]">
                <CalendarClock className="h-3.5 w-3.5 text-[var(--acc-700)]" /> Salva giorni di consegna e orario limite
              </span>
              <span className="block text-[12px] text-[var(--f-muted)]">Li trovi in Consegne: ti avvisiamo prima dell’orario limite.</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-[13px] text-[var(--f-ink-2)]">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[var(--acc-700)]"
              checked={value.saveContact}
              disabled={!value.phones.trim() && !value.emails.includes("@")}
              onChange={(e) => set({ saveContact: e.target.checked })}
            />
            <span>
              <span className="inline-flex items-center gap-1.5 font-medium text-[var(--f-ink)]">
                <MessageCircle className="h-3.5 w-3.5 text-[var(--acc-700)]" /> Usa questi contatti per inviare gli ordini
              </span>
              <span className="block text-[12px] text-[var(--f-muted)]">WhatsApp se c’è un cellulare, altrimenti e-mail o telefono.</span>
            </span>
          </label>
        </div>
      </div>
    </section>
  );
}
