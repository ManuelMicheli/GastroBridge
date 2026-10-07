import Link from "next/link";
import { AlertTriangle, PackageCheck, Thermometer } from "lucide-react";
import { StatusPill } from "@/components/fernly/primitives";
import { ISSUE_LABELS, type LastCheck, type LineCheckMark } from "@/lib/restaurants/receiving/types";

const dtFmt = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** "Ricevi merce" CTA + outcome of the previous check-ins of an order. */
export function ReceivingSummary({
  orderId,
  checks,
  canReceive,
  open,
}: {
  orderId: string;
  checks: LastCheck[];
  canReceive: boolean;
  /** Order still expecting goods (not cancelled / draft). */
  open: boolean;
}) {
  if (!open && checks.length === 0) return null;
  const issues = checks.filter((c) => c.outcome === "issues");
  return (
    <section className="f-card mb-4 p-5" aria-label="Ricevimento merce">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="f-card-title flex items-center gap-2">
            <PackageCheck className="h-4 w-4 text-[var(--acc-600)]" /> Ricevimento merce
          </h2>
          {checks.length === 0 ? (
            <p className="mt-0.5 text-[12.5px] text-[var(--f-muted)]">
              Alla consegna spunta le righe, segnala i problemi con foto e registra lotti e temperature (HACCP).
            </p>
          ) : (
            <ul className="mt-1.5 space-y-1">
              {checks.slice(0, 4).map((c, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 text-[12.5px] text-[var(--f-muted)]">
                  <span>{dtFmt.format(new Date(c.checkedAt))}</span>
                  {c.supplierLabel ? <span className="font-medium text-[var(--f-ink-2)]">{c.supplierLabel}</span> : null}
                  {c.outcome === "ok" ? (
                    <StatusPill tone="success">Conforme</StatusPill>
                  ) : (
                    <StatusPill tone="danger">
                      {c.issueCount} problem{c.issueCount === 1 ? "a" : "i"}
                    </StatusPill>
                  )}
                  {c.messageSent ? <span>· fornitore avvisato in chat</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        {canReceive && open && (
          <Link href={`/ordini/${orderId}/ricevi`} className="f-btn f-btn-primary shrink-0">
            <PackageCheck className="h-4 w-4" /> {checks.length > 0 ? "Nuovo controllo" : "Ricevi merce"}
          </Link>
        )}
      </div>
      {issues.length > 0 && (
        <p className="mt-3 flex items-center gap-2 rounded-[12px] bg-[var(--f-danger-bg)] px-3 py-2 text-[12.5px] text-[var(--f-danger)]">
          <AlertTriangle className="h-4 w-4 shrink-0" /> Righe con problemi segnate qui sotto.
        </p>
      )}
    </section>
  );
}

/** Small badge next to an order line with its latest check-in outcome. */
export function LineCheckBadge({ mark }: { mark: LineCheckMark | undefined }) {
  if (!mark) return null;
  return (
    <span className="ml-2 inline-flex flex-wrap items-center gap-1 align-middle">
      {mark.issue === "ok" ? (
        <StatusPill tone="success">Ricevuto</StatusPill>
      ) : (
        <StatusPill tone="danger">{ISSUE_LABELS[mark.issue]}</StatusPill>
      )}
      {mark.temperatureOk === false && (
        <StatusPill tone="danger">
          <Thermometer className="h-3 w-3" /> T°
        </StatusPill>
      )}
      {mark.lotNumber ? <span className="text-[11px] text-[var(--f-muted)]">lotto {mark.lotNumber}</span> : null}
    </span>
  );
}
