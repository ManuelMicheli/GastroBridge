"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Store } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { resumeFiscalIntegration } from "@/lib/fiscal/actions";
import { syncSdiNow } from "@/lib/invoices/actions";
import type { ConnectionCard, FixAction, Health } from "@/lib/finance/connections";
import { cn } from "@/lib/utils/formatters";

const DOT: Record<Health, string> = {
  ok: "bg-[var(--f-success)]",
  waiting: "bg-[var(--f-warning)] animate-pulse",
  warning: "bg-[var(--f-warning)]",
  error: "bg-[var(--f-danger)]",
  off: "bg-[var(--f-faint)]",
};
const HEALTH_LABEL: Record<Health, string> = {
  ok: "Funziona",
  waiting: "In attesa",
  warning: "Da controllare",
  error: "Da sistemare",
  off: "Non attivo",
};

const timeFmt = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });

/** Unified "Stato collegamenti": POS + SDI health with one fix-it action each. */
export function ConnectionsPanel({ cards, canWrite, compact = false }: { cards: ConnectionCard[]; canWrite: boolean; compact?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function runFix(fix: FixAction) {
    start(async () => {
      try {
        if (fix.action === "resume_pos" && fix.targetId) {
          await resumeFiscalIntegration(fix.targetId);
          toast.success("Cassa riattivata");
        } else if (fix.action === "sync_sdi") {
          const res = await syncSdiNow();
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success(res.data.imported > 0 ? `${res.data.imported} nuove fatture` : "Controllato: nessuna nuova fattura");
        }
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Operazione non riuscita");
      }
    });
  }

  return (
    <ul className={cn("divide-y divide-[var(--f-line)]", compact && "-my-1")}>
      {cards.map((c) => (
        <li key={c.key} className={cn("flex flex-col gap-2 sm:flex-row sm:items-center", compact ? "py-2.5" : "py-3.5")}>
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="relative mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[var(--f-fill)] text-[var(--f-ink-2)]">
              {c.kind === "sdi" ? <FileText className="h-4 w-4" aria-hidden /> : <Store className="h-4 w-4" aria-hidden />}
              <span className={cn("absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--f-card)]", DOT[c.health])} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-medium text-[var(--f-ink)]">
                {c.title}
                <span className="sr-only"> — {HEALTH_LABEL[c.health]}</span>
              </p>
              <p className="text-[13px] text-[var(--f-ink-2)]">{c.status}</p>
              {!compact && c.detail && <p className="text-[12.5px] text-[var(--f-muted)]">{c.detail}</p>}
              {!compact && c.lastSync && (
                <p className="text-[11.5px] text-[var(--f-faint)]">Ultimo controllo {timeFmt.format(new Date(c.lastSync))}</p>
              )}
            </div>
          </div>
          {c.fix &&
            (c.fix.href ? (
              <Link href={c.fix.href} className={cn("f-btn f-btn-sm shrink-0 self-start sm:self-auto", c.health === "error" ? "f-btn-primary" : "f-btn-soft")}>
                {c.fix.label}
              </Link>
            ) : canWrite ? (
              <button
                type="button"
                className="f-btn f-btn-sm f-btn-soft shrink-0 self-start sm:self-auto"
                onClick={() => runFix(c.fix!)}
                disabled={pending}
              >
                {c.fix.label}
              </button>
            ) : null)}
        </li>
      ))}
    </ul>
  );
}
