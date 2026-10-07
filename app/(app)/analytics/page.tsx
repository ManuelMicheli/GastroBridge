import type { Metadata } from "next";
import { getRestaurantAnalytics } from "@/lib/analytics/restaurant";
import { isPeriodKey, type PeriodKey } from "@/lib/analytics/period";
import { AnalyticsContent } from "./analytics-client";
import { contextCan, getRestaurantContext } from "@/lib/restaurants/context";
import { RESTAURANT_ROLE_LABELS } from "@/lib/restaurants/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { FCard } from "@/components/fernly/primitives";

export const metadata: Metadata = { title: "Analytics — GastroBridge" };
// Cookie-bound auth read already makes this dynamic. Avoid `force-dynamic` so
// Next 15 keeps the RSC payload in the client router cache (staleTimes.dynamic).

type SearchParams = Promise<{ period?: string }>;

export default async function AnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const { period: rawPeriod } = await searchParams;
  const period: PeriodKey = isPeriodKey(rawPeriod) ? rawPeriod : "current";
  const ctx = await getRestaurantContext();
  if (ctx && !contextCan(ctx, "analytics.financial")) {
    return (
      <div className="px-1 pt-3 lg:px-0 lg:pt-0">
        <PageHeader title="Analytics" subtitle="Spesa, ordini e fornitori del ristorante." />
        <FCard index={0}>
          <p className="f-card-title">Accesso limitato</p>
          <p className="mt-1.5 text-[13.5px] text-[var(--f-muted)]">
            Il tuo ruolo ({RESTAURANT_ROLE_LABELS[ctx.role]}) non include i dati economici del ristorante.
          </p>
        </FCard>
      </div>
    );
  }
  const data = await getRestaurantAnalytics(period);
  return <AnalyticsContent data={data} />;
}
