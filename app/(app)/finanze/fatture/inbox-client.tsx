"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { Chips } from "@/components/fernly/chips";
import { CardEmpty, IconTile, StatusPill } from "@/components/fernly/primitives";
import { CREDIT_NOTE_TYPES, documentTypeLabel } from "@/lib/invoices/fatturapa";
import { STATUS_LABELS, STATUS_TONES } from "@/lib/invoices/status";
import type { InvoiceStatus } from "@/lib/invoices/types";
import type { FTone } from "@/components/fernly/primitives";

export type InboxItem = {
  id: string;
  supplier_name: string | null;
  supplier_vat: string | null;
  document_type: string;
  document_number: string;
  document_date: string | null;
  total_amount: number;
  status: InvoiceStatus;
  open_cents: number;
  disputed_cents: number;
  recovered_cents: number;
  findings_count: number;
  received_via: string;
};

type Filter = "tutte" | InvoiceStatus;

const ORDER: Filter[] = ["tutte", "anomalie", "da_verificare", "contestata", "risolta", "ok"];

const eur = new Intl.NumberFormat("it-IT", { useGrouping: "always", style: "currency", currency: "EUR" });
const dateFmt = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Rome" });

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function InboxClient({ items, initialFilter }: { items: InboxItem[]; initialFilter: Filter }) {
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [q, setQ] = useState("");
  const [supplier, setSupplier] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = { tutte: items.length };
    for (const i of items) c[i.status] = (c[i.status] ?? 0) + 1;
    return c;
  }, [items]);

  const suppliers = useMemo(
    () => [...new Set(items.map((i) => i.supplier_name ?? "").filter(Boolean))].sort((a, b) => a.localeCompare(b, "it")),
    [items],
  );

  const shown = useMemo(() => {
    const needle = norm(q.trim());
    return items.filter(
      (i) =>
        (filter === "tutte" || i.status === filter) &&
        (!supplier || i.supplier_name === supplier) &&
        (!needle || norm(`${i.supplier_name ?? ""} ${i.document_number} ${i.supplier_vat ?? ""}`).includes(needle)),
    );
  }, [items, filter, q, supplier]);

  const options = ORDER.filter((f) => f === "tutte" || f === filter || (counts[f] ?? 0) > 0).map((f) => ({
    value: f,
    label: f === "tutte" ? "Tutte" : STATUS_LABELS[f],
    count: counts[f] ?? 0,
  }));

  return (
    <div className="space-y-3">
      <Chips options={options} value={filter} onChange={setFilter} ariaLabel="Filtra per stato" />
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Cerca fornitore o numero</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--f-faint)]" aria-hidden />
          <input className="f-input !pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca fornitore, numero o P.IVA" />
        </label>
        {suppliers.length > 1 && (
          <select className="f-input sm:!w-56" value={supplier} onChange={(e) => setSupplier(e.target.value)} aria-label="Fornitore">
            <option value="">Tutti i fornitori</option>
            {suppliers.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>

      {shown.length === 0 ? (
        <CardEmpty>{items.length === 0 ? "Nessuna fattura ancora." : "Nessuna fattura con questi filtri."}</CardEmpty>
      ) : (
        <ul className="divide-y divide-[var(--f-line)]">
          {shown.map((i) => {
            const credit = CREDIT_NOTE_TYPES.has(i.document_type);
            return (
              <li key={i.id}>
                <Link
                  href={`/finanze/fatture/${i.id}`}
                  className="-mx-2 flex items-center gap-3 rounded-[12px] px-2 py-3 transition-colors hover:bg-[var(--f-fill)]"
                >
                  <IconTile seed={i.supplier_name ?? i.supplier_vat ?? i.id}>
                    <span className="text-[12px] font-semibold">{(i.supplier_name ?? "?").slice(0, 2).toUpperCase()}</span>
                  </IconTile>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-[var(--f-ink)]">{i.supplier_name ?? "Fornitore sconosciuto"}</p>
                    <p className="truncate text-[12px] text-[var(--f-muted)]">
                      {credit ? "Nota di credito" : i.document_type === "TD01" ? "Fattura" : documentTypeLabel(i.document_type)} n.{" "}
                      {i.document_number}
                      {i.document_date ? ` · ${dateFmt.format(new Date(`${i.document_date}T12:00:00Z`))}` : ""}
                      {i.received_via !== "upload" ? " · SDI" : ""}
                    </p>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-[14px] font-semibold tabular-nums text-[var(--f-ink)]">
                      {credit ? "−" : ""}
                      {eur.format(Math.abs(Number(i.total_amount)))}
                    </p>
                    {i.status === "anomalie" && i.open_cents > 0 ? (
                      <p className="text-[12px] font-medium tabular-nums text-[var(--f-danger)]">{eur.format(i.open_cents / 100)} da recuperare</p>
                    ) : i.status === "contestata" && i.disputed_cents > 0 ? (
                      <p className="text-[12px] tabular-nums text-[var(--f-warning)]">{eur.format(i.disputed_cents / 100)} richiesti</p>
                    ) : i.recovered_cents > 0 ? (
                      <p className="text-[12px] tabular-nums text-[var(--f-success)]">{eur.format(i.recovered_cents / 100)} recuperati</p>
                    ) : null}
                  </div>
                  <StatusPill tone={STATUS_TONES[i.status] as FTone} dot className="shrink-0">
                    {STATUS_LABELS[i.status]}
                  </StatusPill>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--f-faint)]" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
