import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { FCard } from "@/components/fernly/primitives";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { createClient } from "@/lib/supabase/server";
import { getCurrentSupplierMember, memberCan } from "@/lib/supplier/current-member";
import { listDriversForSupplier } from "@/lib/supplier/delivery/queries";
import { loadGiro } from "@/lib/supplier/route/queries";
import { addDaysKey, todayKey } from "@/lib/supplier/intel/time";
import { GiroClient } from "./giro-client";

export const metadata: Metadata = { title: "Giro consegne — GastroBridge Fornitore" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ date?: string; driver?: string }>;

export default async function GiroPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : todayKey();

  const member = await getCurrentSupplierMember();
  const canPlan = memberCan(member, "delivery.plan");
  const canExecute = memberCan(member, "delivery.execute");
  if (!member || (!canPlan && !canExecute)) {
    return (
      <div className="px-1 pt-3 lg:px-0 lg:pt-0">
        <PageHeader title="Giro consegne" />
        <FCard>
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Lock className="h-5 w-5 text-[var(--f-muted)]" aria-hidden />
            <p className="text-[13px] text-[var(--f-muted)]">Il tuo ruolo non ha accesso alle consegne.</p>
          </div>
        </FCard>
      </div>
    );
  }

  // Drivers see only their own stops; planners can filter by driver.
  const driverOnly = member.role === "driver" && !canPlan;
  const driverFilter = driverOnly ? member.id : sp.driver && /^[0-9a-f-]{36}$/.test(sp.driver) ? sp.driver : null;

  const supabase = await createClient();
  const [giro, drivers] = await Promise.all([
    loadGiro(supabase, member.supplier_id, date, driverFilter),
    driverOnly ? Promise.resolve([]) : listDriversForSupplier(member.supplier_id),
  ]);

  const pretty = new Date(`${date}T12:00:00Z`).toLocaleDateString("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const q = (d: string) => `/supplier/giro?date=${d}${driverFilter && !driverOnly ? `&driver=${driverFilter}` : ""}`;

  return (
    <div className="px-1 pt-3 lg:px-0 lg:pt-0">
      <RealtimeRefresh subscriptions={[{ table: "deliveries", filter: `scheduled_date=eq.${date}` }]} />
      <PageHeader
        title={driverOnly ? "Il mio giro" : "Giro consegne"}
        subtitle={`${pretty.charAt(0).toUpperCase()}${pretty.slice(1)} · ${giro.stops.length} fermate`}
        actions={
          <div className="flex items-center gap-1">
            <Link href={q(addDaysKey(date, -1))} className="f-icon-btn" aria-label="Giorno precedente">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link href={q(todayKey())} className="f-btn f-btn-outline f-btn-sm">
              Oggi
            </Link>
            <Link href={q(addDaysKey(date, 1))} className="f-icon-btn" aria-label="Giorno successivo">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        }
      />

      {!driverOnly && drivers.length > 0 && (
        <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
          <input type="hidden" name="date" value={date} />
          <label htmlFor="giro-driver" className="text-[13px] text-[var(--f-muted)]">
            Autista
          </label>
          <select id="giro-driver" name="driver" defaultValue={driverFilter ?? ""} className="f-input h-9 w-auto py-0">
            <option value="">Tutti</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.display_name}
              </option>
            ))}
          </select>
          <button type="submit" className="f-btn f-btn-soft f-btn-sm">
            Filtra
          </button>
        </form>
      )}

      <GiroClient
        key={`${date}-${driverFilter ?? "all"}-${giro.stops.map((s) => s.id).join(",")}`}
        giro={giro}
        canReorder={canPlan || (driverOnly && giro.stops.every((s) => s.driverMemberId === member.id))}
        isDriver={driverOnly}
      />
    </div>
  );
}
