import Link from "next/link";
import { Lock } from "lucide-react";
import { CardEmpty, FCard, StatusPill, type FTone } from "@/components/fernly/primitives";
import { STATUS_LABELS, STATUS_TONES } from "@/lib/invoices/status";
import type { InvoiceStatus } from "@/lib/invoices/types";

export function NoFinanceAccess({ message }: { message: string }) {
  return (
    <div className="px-1 lg:px-0">
      <FCard>
        <CardEmpty action={<Link href="/dashboard" className="f-btn f-btn-sm f-btn-soft">Torna alla dashboard</Link>}>
          <span className="inline-flex items-center gap-2">
            <Lock className="h-4 w-4" aria-hidden /> {message}
          </span>
        </CardEmpty>
      </FCard>
    </div>
  );
}

export function InvoiceStatusPill({ status, className }: { status: InvoiceStatus; className?: string }) {
  return (
    <StatusPill tone={STATUS_TONES[status] as FTone} dot className={className}>
      {STATUS_LABELS[status]}
    </StatusPill>
  );
}

const eurFmt = new Intl.NumberFormat("it-IT", { useGrouping: "always", style: "currency", currency: "EUR" });
const eur0Fmt = new Intl.NumberFormat("it-IT", { useGrouping: "always", style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function eurCents(cents: number, round = false): string {
  return (round ? eur0Fmt : eurFmt).format(cents / 100);
}

export function eur(n: number | null | undefined, round = false): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return (round ? eur0Fmt : eurFmt).format(n);
}

const dateFmt = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Rome" });
const shortFmt = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: "Europe/Rome" });

export function dateIt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d);
}

export function dateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : shortFmt.format(d);
}

export function pctIt(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits).replace(".", ",")}%`;
}

export function qtyIt(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("it-IT", { useGrouping: "always", maximumFractionDigits: 3 }).format(n);
}

/** Small stat card used across the Finanze pages. */
export function StatCard({
  index,
  label,
  value,
  caption,
  tone = "ink",
  href,
}: {
  index?: number;
  label: string;
  value: string;
  caption?: string;
  tone?: "ink" | "danger" | "success" | "accent" | "warning";
  href?: string;
}) {
  const color =
    tone === "danger"
      ? "text-[var(--f-danger)]"
      : tone === "success"
        ? "text-[var(--f-success)]"
        : tone === "warning"
          ? "text-[var(--f-warning)]"
          : tone === "accent"
            ? "text-[var(--acc-ink)]"
            : "text-[var(--f-ink)]";
  const body = (
    <>
      <p className="text-[14px] text-[var(--f-muted)]">{label}</p>
      <p className={`mt-1 text-[28px] font-semibold tabular-nums tracking-[-0.02em] sm:text-[32px] ${color}`}>{value}</p>
      {caption ? <p className="mt-1 text-[12.5px] text-[var(--f-muted)]">{caption}</p> : null}
    </>
  );
  return (
    <FCard index={index} className={href ? "transition-transform duration-200 hover:-translate-y-0.5" : undefined}>
      {href ? (
        <Link href={href} className="block">
          {body}
        </Link>
      ) : (
        body
      )}
    </FCard>
  );
}
