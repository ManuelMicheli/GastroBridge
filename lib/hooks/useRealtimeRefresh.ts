"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Subscription = {
  table: string;
  filter?: string;
  schema?: string;
};

export function useRealtimeRefresh(subscriptions: Subscription[]) {
  const router = useRouter();

  useEffect(() => {
    if (subscriptions.length === 0) return;

    const supabase = createClient();
    const channelName = `rt_${subscriptions.map((s) => s.table).join("_")}_${Math.random().toString(36).slice(2, 8)}`;
    let channel = supabase.channel(channelName);

    for (const sub of subscriptions) {
      const config: {
        event: "*";
        schema: string;
        table: string;
        filter?: string;
      } = {
        event: "*",
        schema: sub.schema ?? "public",
        table: sub.table,
      };
      if (sub.filter) config.filter = sub.filter;

      channel = channel.on("postgres_changes", config, () => {
        router.refresh();
      });
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(subscriptions)]);
}
