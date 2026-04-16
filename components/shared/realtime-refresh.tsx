"use client";

import { useRealtimeRefresh } from "@/lib/hooks/useRealtimeRefresh";

type Subscription = {
  table: string;
  filter?: string;
  schema?: string;
};

export function RealtimeRefresh({ subscriptions }: { subscriptions: Subscription[] }) {
  useRealtimeRefresh(subscriptions);
  return null;
}
