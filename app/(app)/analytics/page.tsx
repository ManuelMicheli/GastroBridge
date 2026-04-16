import type { Metadata } from "next";
import { getRestaurantAnalytics } from "@/lib/analytics/restaurant";
import { isPeriodKey, type PeriodKey } from "@/lib/analytics/period";
import { AnalyticsContent } from "./analytics-client";

export const metadata: Metadata = { title: "Analytics — GastroBridge" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Promise<{ period?: string }>;

export default async function AnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const { period: rawPeriod } = await searchParams;
  const period: PeriodKey = isPeriodKey(rawPeriod) ? rawPeriod : "current";
  const data = await getRestaurantAnalytics(period);
  return <AnalyticsContent data={data} />;
}
