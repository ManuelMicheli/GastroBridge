import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeliveryCard } from "@/components/supplier/delivery/delivery-card";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import {
  listDeliveriesForDate,
  listDriversForSupplier,
  getActiveMember,
} from "@/lib/supplier/delivery/queries";
import { hasPermission } from "@/lib/supplier/permissions";
import type { SupplierRole } from "@/types/database";
import { Truck, Calendar } from "lucide-react";

export const metadata: Metadata = { title: "Consegne del giorno" };

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

/**
 * Ritorna la data odierna in timezone Europe/Rome in formato ISO yyyy-mm-dd.
 * Usiamo `Intl.DateTimeFormat` per evitare problemi di TZ sul server.
 */
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

  if (!user) {
    return (
      <Card className="py-16 text-center">
        <p className="text-sage">Sessione non valida.</p>
      </Card>
    );
  }

  const { data: member } = await supabase
    .from("supplier_members")
    .select("id, role, supplier_id")
    .eq("profile_id", user.id)
    .eq("is_active", true)
    .not("accepted_at", "is", null)
    .limit(1)
    .maybeSingle<{ id: string; role: SupplierRole; supplier_id: string }>();

  if (!member) {
    return (
      <Card className="py-16 text-center">
        <p className="text-sage">Nessuna appartenenza attiva.</p>
      </Card>
    );
  }

  if (!hasPermission(member.role, "delivery.execute")) {
    return (
      <div>
        <h1 className="mb-6 font-display text-3xl text-text-primary">
          Consegne<span className="text-brand-primary">.</span>
        </h1>
        <Card className="py-16 text-center">
          <Truck className="mx-auto mb-4 h-12 w-12 text-sage-muted" />
          <p className="text-sage">
            Il tuo ruolo non ha accesso alle consegne.
          </p>
        </Card>
      </div>
    );
  }

  const canPlan = hasPermission(member.role, "delivery.plan");

  // Driver senza delivery.plan → filtro forzato sulle proprie consegne.
  // Admin/warehouse con delivery.plan → vedono tutte, con opzione di filtro driver.
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

  void activeMember; // usato implicitamente per coerenza sessione; utile in futuro.

  const deliveries = deliveriesRes.ok ? deliveriesRes.data : [];

  const totalPlanned = deliveries.filter((d) => d.status === "planned").length;
  const inTransit = deliveries.filter((d) => d.status === "in_transit").length;
  const completed = deliveries.filter((d) => d.status === "delivered").length;
  const failed = deliveries.filter((d) => d.status === "failed").length;

  return (
    <div className="space-y-6">
      <RealtimeRefresh
        subscriptions={[
          {
            table: "deliveries",
            filter: `scheduled_date=eq.${date}`,
          },
        ]}
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-display text-3xl text-text-primary">
            Consegne<span className="text-brand-primary">.</span>
          </h1>
          <p className="mt-1 text-sm text-sage capitalize">
            {formatItalianDate(date)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/supplier/consegne?date=${previousDay(date)}${
              driverParam ? `&driver=${driverParam}` : ""
            }`}
          >
            <Button size="sm" variant="secondary">
              ← Giorno prec.
            </Button>
          </Link>
          <Link href={`/supplier/consegne?date=${todayRomeISO()}`}>
            <Button size="sm" variant="ghost">
              <Calendar className="h-4 w-4" /> Oggi
            </Button>
          </Link>
          <Link
            href={`/supplier/consegne?date=${nextDay(date)}${
              driverParam ? `&driver=${driverParam}` : ""
            }`}
          >
            <Button size="sm" variant="secondary">
              Giorno succ. →
            </Button>
          </Link>
        </div>
      </div>

      {canPlan && driverOptions.length > 0 && (
        <form method="get" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="date" value={date} />
          <label className="text-sm text-sage">
            Filtra driver
            <select
              name="driver"
              defaultValue={driverParam}
              className="ml-2 rounded-md border border-sage-muted bg-white px-3 py-1.5 text-sm text-charcoal"
            >
              <option value="">Tutti</option>
              {driverOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.display_name}
                </option>
              ))}
            </select>
          </label>
          <Button size="sm" type="submit" variant="primary">
            Applica
          </Button>
          {driverParam && (
            <Link href={`/supplier/consegne?date=${date}`}>
              <Button size="sm" variant="ghost" type="button">
                Reset
              </Button>
            </Link>
          )}
        </form>
      )}

      <div
        className="cq-section grid gap-3"
        style={{
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(160px, 100%), 1fr))",
        }}
      >
        <SummaryTile label="Pianificate" value={totalPlanned} />
        <SummaryTile label="In transito" value={inTransit} />
        <SummaryTile label="Consegnate" value={completed} />
        <SummaryTile label="Fallite" value={failed} />
      </div>

      {!deliveriesRes.ok ? (
        <Card className="py-16 text-center">
          <p className="text-red-600">{deliveriesRes.error}</p>
        </Card>
      ) : deliveries.length === 0 ? (
        <Card className="py-16 text-center">
          <Truck className="mx-auto mb-4 h-12 w-12 text-sage-muted" />
          <p className="text-sage">Nessuna consegna per questa data.</p>
        </Card>
      ) : (
        <div
          className="cq-section grid gap-4"
          style={{
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
          }}
        >
          {deliveries.map((d) => (
            <DeliveryCard key={d.id} delivery={d} />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-3">
      <p className="text-xs uppercase tracking-wider text-sage">{label}</p>
      <p className="mt-1 text-2xl font-bold text-charcoal">{value}</p>
    </Card>
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
