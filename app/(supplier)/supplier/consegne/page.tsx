import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DeliveryCard } from "@/components/supplier/delivery/delivery-card";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import {
  listDeliveriesForDate,
  listDriversForSupplier,
  getActiveMember,
} from "@/lib/supplier/delivery/queries";
import { hasPermission } from "@/lib/supplier/permissions";
import type { SupplierRole } from "@/types/database";
import { Calendar, ChevronLeft, ChevronRight, Truck } from "lucide-react";
import { LargeTitle } from "@/components/ui/large-title";
import { SectionFrame } from "@/components/dashboard/supplier/_awwwards/section-frame";

export const metadata: Metadata = { title: "Consegne del giorno" };

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

function todayRomeISO(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

function formatItalianDate(isoDate: string): string {
  try {
    const d = new Date(`${isoDate}T00:00:00`);
    return d.toLocaleDateString("it-IT", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return isoDate;
  }
}

function TerminalEmpty({
  title,
  body,
  icon,
}: {
  title: string;
  body?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-card px-6 py-16 text-center">
      {icon}
      <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
        {title}
      </p>
      {body && <p className="mt-2 text-[13px] text-text-secondary">{body}</p>}
    </div>
  );
}

export default async function SupplierConsegnePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const dateParam = firstParam(sp.date).trim();
  const driverParam = firstParam(sp.driver).trim();
  const date = dateParam || todayRomeISO();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <TerminalEmpty title="Sessione non valida" />;

  const { data: member } = await supabase
    .from("supplier_members")
    .select("id, role, supplier_id")
    .eq("profile_id", user.id)
    .eq("is_active", true)
    .not("accepted_at", "is", null)
    .limit(1)
    .maybeSingle<{ id: string; role: SupplierRole; supplier_id: string }>();

  if (!member) {
    return <TerminalEmpty title="Nessuna appartenenza attiva" />;
  }

  if (!hasPermission(member.role, "delivery.execute")) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
              Consegne · pianificazione giornaliera
            </span>
            <span aria-hidden className="h-px flex-1 bg-border-subtle" />
          </div>
          <h1
            className="mt-4 font-display"
            style={{
              fontSize: "var(--text-display-lg)",
              lineHeight: "var(--text-display-lg--line-height)",
              letterSpacing: "var(--text-display-lg--letter-spacing)",
              fontWeight: "var(--text-display-lg--font-weight)",
              color: "var(--color-text-primary)",
            }}
          >
            Consegne
          </h1>
        </header>
        <TerminalEmpty
          icon={
            <Truck
              className="mx-auto mb-3 h-7 w-7 text-text-tertiary"
              aria-hidden
            />
          }
          title="Accesso limitato"
          body="Il tuo ruolo non ha accesso alle consegne"
        />
      </div>
    );
  }

  const canPlan = hasPermission(member.role, "delivery.plan");

  const effectiveDriverFilter = !canPlan
    ? member.id
    : driverParam
      ? driverParam
      : null;

  const [deliveriesRes, driverOptions, activeMember] = await Promise.all([
    listDeliveriesForDate({
      supplierId: member.supplier_id,
      date,
      driverMemberId: effectiveDriverFilter,
    }),
    canPlan ? listDriversForSupplier(member.supplier_id) : Promise.resolve([]),
    getActiveMember(member.supplier_id),
  ]);

  void activeMember;

  const deliveries = deliveriesRes.ok ? deliveriesRes.data : [];

  const totalPlanned = deliveries.filter((d) => d.status === "planned").length;
  const inTransit = deliveries.filter((d) => d.status === "in_transit").length;
  const completed = deliveries.filter((d) => d.status === "delivered").length;
  const failed = deliveries.filter((d) => d.status === "failed").length;

  return (
    <>
      <RealtimeRefresh
        subscriptions={[
          { table: "deliveries", filter: `scheduled_date=eq.${date}` },
        ]}
      />

      {/* Mobile — untouched */}
      <div className="lg:hidden">
        <LargeTitle
          eyebrow={
            <span className="capitalize">{formatItalianDate(date)}</span>
          }
          title="Consegne"
          subtitle="Pianificazione giornaliera"
        />
        <div className="mx-3 mt-3 flex items-center justify-between gap-2 rounded-lg bg-[color:var(--ios-fill-quinary)] p-1">
          <Link
            href={`/supplier/consegne?date=${previousDay(date)}${
              driverParam ? `&driver=${driverParam}` : ""
            }`}
            className="flex-1 rounded-md py-2 text-center text-[12px] font-medium active:bg-white/60"
          >
            ←
          </Link>
          <Link
            href={`/supplier/consegne?date=${todayRomeISO()}`}
            className="flex-1 rounded-md py-2 text-center text-[12px] font-semibold text-[color:var(--color-brand-primary)] active:bg-white/60"
          >
            Oggi
          </Link>
          <Link
            href={`/supplier/consegne?date=${nextDay(date)}${
              driverParam ? `&driver=${driverParam}` : ""
            }`}
            className="flex-1 rounded-md py-2 text-center text-[12px] font-medium active:bg-white/60"
          >
            →
          </Link>
        </div>
        {deliveries.length > 0 && (
          <div className="mx-3 mt-3 grid gap-3 sm:grid-cols-2">
            {deliveries.map((d) => (
              <DeliveryCard key={d.id} delivery={d} />
            ))}
          </div>
        )}
      </div>

      {/* Desktop — terminal delivery console */}
      <div className="hidden lg:block">
        <div className="flex flex-col gap-6">
          <header>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
                Consegne · pianificazione giornaliera · tracking
              </span>
              <span aria-hidden className="h-px flex-1 bg-border-subtle" />
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
                {deliveries.length} totali
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1
                  className="font-display"
                  style={{
                    fontSize: "var(--text-display-lg)",
                    lineHeight: "var(--text-display-lg--line-height)",
                    letterSpacing: "var(--text-display-lg--letter-spacing)",
                    fontWeight: "var(--text-display-lg--font-weight)",
                    color: "var(--color-text-primary)",
                  }}
                >
                  Consegne
                </h1>
                <p className="mt-1.5 text-sm text-text-secondary capitalize">
                  {formatItalianDate(date)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <Link
                  href={`/supplier/consegne?date=${previousDay(date)}${
                    driverParam ? `&driver=${driverParam}` : ""
                  }`}
                  className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-surface-card px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-text-secondary transition-colors hover:border-accent-green hover:text-accent-green"
                >
                  <ChevronLeft className="h-3 w-3" aria-hidden /> prec
                </Link>
                <Link
                  href={`/supplier/consegne?date=${todayRomeISO()}`}
                  className="inline-flex items-center gap-1 rounded-md border border-accent-green/40 bg-accent-green/10 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-accent-green transition-colors hover:bg-accent-green/20"
                >
                  <Calendar className="h-3 w-3" aria-hidden /> oggi
                </Link>
                <Link
                  href={`/supplier/consegne?date=${nextDay(date)}${
                    driverParam ? `&driver=${driverParam}` : ""
                  }`}
                  className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-surface-card px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-text-secondary transition-colors hover:border-accent-green hover:text-accent-green"
                >
                  succ <ChevronRight className="h-3 w-3" aria-hidden />
                </Link>
              </div>
            </div>
          </header>

          {canPlan && driverOptions.length > 0 && (
            <form
              method="get"
              className="flex flex-wrap items-center gap-2 rounded-xl border border-border-subtle bg-surface-card px-3 py-2"
            >
              <input type="hidden" name="date" value={date} />
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
                Filtra driver
              </span>
              <select
                name="driver"
                defaultValue={driverParam}
                className="rounded-md border border-border-subtle bg-surface-base px-2 py-1 font-mono text-[11px] text-text-primary focus:border-accent-green focus:outline-none"
              >
                <option value="">Tutti</option>
                {driverOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.display_name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="inline-flex items-center rounded-md border border-accent-green/40 bg-accent-green/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-accent-green hover:bg-accent-green/20"
              >
                Applica
              </button>
              {driverParam && (
                <Link
                  href={`/supplier/consegne?date=${date}`}
                  className="inline-flex items-center rounded-md border border-border-subtle px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary hover:text-text-primary"
                >
                  reset
                </Link>
              )}
            </form>
          )}

          <SectionFrame label="Snapshot · giornata" padded={false}>
            <div
              className="grid gap-3 p-4"
              style={{
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(min(180px, 100%), 1fr))",
              }}
            >
              <SummaryTile
                index="01"
                label="Pianificate"
                value={totalPlanned}
              />
              <SummaryTile
                index="02"
                label="In transito"
                value={inTransit}
                tone="blue"
              />
              <SummaryTile
                index="03"
                label="Consegnate"
                value={completed}
                tone="green"
              />
              <SummaryTile
                index="04"
                label="Fallite"
                value={failed}
                tone="red"
              />
            </div>
          </SectionFrame>

          {!deliveriesRes.ok ? (
            <TerminalEmpty title="Errore caricamento" body={deliveriesRes.error} />
          ) : deliveries.length === 0 ? (
            <TerminalEmpty
              icon={
                <Truck
                  className="mx-auto mb-3 h-7 w-7 text-text-tertiary"
                  aria-hidden
                />
              }
              title="Nessuna consegna per questa data"
              body="Usa la navigazione giorno per cambiare data."
            />
          ) : (
            <SectionFrame
              label={`Consegne · ${date} · ${deliveries.length}`}
              padded={false}
            >
              <div
                className="grid gap-4 p-4"
                style={{
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
                }}
              >
                {deliveries.map((d) => (
                  <DeliveryCard key={d.id} delivery={d} />
                ))}
              </div>
            </SectionFrame>
          )}
        </div>
      </div>
    </>
  );
}

function SummaryTile({
  index,
  label,
  value,
  tone,
}: {
  index: string;
  label: string;
  value: number;
  tone?: "blue" | "green" | "red";
}) {
  const toneClass =
    tone === "blue"
      ? "text-accent-blue"
      : tone === "green"
        ? "text-accent-green"
        : tone === "red"
          ? "text-accent-red"
          : "text-text-primary";
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border-subtle bg-surface-card px-4 py-3">
      <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
        <span className="text-text-tertiary/70 tabular-nums">{index}</span>
        <span aria-hidden className="text-border-subtle">
          ·
        </span>
        <span className="truncate">{label}</span>
      </span>
      <span
        className={`font-mono tabular-nums ${toneClass}`}
        style={{ fontSize: "22px", fontWeight: 500, letterSpacing: "-0.011em" }}
      >
        {value.toLocaleString("it-IT")}
      </span>
    </div>
  );
}

function shiftDay(isoDate: string, days: number): string {
  try {
    const d = new Date(`${isoDate}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  } catch {
    return isoDate;
  }
}

function previousDay(isoDate: string): string {
  return shiftDay(isoDate, -1);
}

function nextDay(isoDate: string): string {
  return shiftDay(isoDate, 1);
}
