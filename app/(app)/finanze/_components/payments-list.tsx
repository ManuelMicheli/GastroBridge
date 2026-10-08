"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { CardEmpty, StatusPill } from "@/components/fernly/primitives";
import { setPaymentPaid } from "@/lib/invoices/actions";
import { paymentMethodLabel } from "@/lib/invoices/fatturapa";

export type PaymentItem = {
  id: string;
  invoice_id: string;
  due_date: string | null;
  amount: number | null;
  method: string | null;
  iban: string | null;
  supplier_name: string | null;
  document_number: string;
  overdue: boolean;
};

const eur = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const dayFmt = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Rome" });

function dueLabel(iso: string | null): string {
  if (!iso) return "—";
  return dayFmt.format(new Date(`${iso}T12:00:00Z`));
}

/** Upcoming supplier payment due dates, with "Segnato come pagato". */
export function PaymentsList({ items, canWrite, limit = 8 }: { items: PaymentItem[]; canWrite: boolean; limit?: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visible = items.filter((p) => !hidden.has(p.id)).slice(0, limit);

  if (visible.length === 0) {
    return <CardEmpty>Nessun pagamento in scadenza nei prossimi 30 giorni.</CardEmpty>;
  }
  const total = visible.reduce((s, p) => s + (p.amount ?? 0), 0);

  function markPaid(id: string) {
    start(async () => {
      const res = await setPaymentPaid(id, true);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setHidden((h) => new Set(h).add(id));
      toast.success("Segnato come pagato");
      router.refresh();
    });
  }

  return (
    <div>
      <ul className="divide-y divide-[var(--f-line)]">
        {visible.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2.5">
            <div className="w-[74px] shrink-0">
              <p className={`text-[13px] font-medium ${p.overdue ? "text-[var(--f-danger)]" : "text-[var(--f-ink)]"}`}>{dueLabel(p.due_date)}</p>
              {p.overdue && <StatusPill tone="danger">Scaduto</StatusPill>}
            </div>
            <Link href={`/finanze/fatture/${p.invoice_id}`} className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-[var(--f-ink)]">{p.supplier_name ?? "Fornitore"}</p>
              <p className="truncate text-[12px] text-[var(--f-muted)]">
                Fatt. {p.document_number}
                {p.method ? ` · ${paymentMethodLabel(p.method)}` : ""}
              </p>
            </Link>
            <span className="shrink-0 text-[14px] font-semibold tabular-nums text-[var(--f-ink)]">
              {p.amount !== null ? eur.format(p.amount) : "—"}
            </span>
            {canWrite && (
              <button
                type="button"
                className="f-icon-btn !h-8 !w-8"
                onClick={() => markPaid(p.id)}
                disabled={pending}
                aria-label={`Segna pagata la fattura ${p.document_number}`}
                title="Segna come pagata"
              >
                <Check className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-right text-[12.5px] text-[var(--f-muted)]">
        Totale: <span className="font-semibold tabular-nums text-[var(--f-ink)]">{eur.format(total)}</span>
      </p>
    </div>
  );
}
