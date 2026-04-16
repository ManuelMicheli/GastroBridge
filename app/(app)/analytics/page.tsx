import type { Metadata } from "next";
import { getRestaurantAnalytics } from "@/lib/analytics/restaurant";
import { AnalyticsContent } from "./analytics-client";

export const metadata: Metadata = { title: "Analytics — GastroBridge" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AnalyticsPage() {
  const data = await getRestaurantAnalytics();
  return <AnalyticsContent data={data} />;
}
