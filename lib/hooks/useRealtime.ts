"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function useRealtime(
  table: string,
  filter: string | undefined,
  onInsert?: (payload: Record<string, unknown>) => void,
  onUpdate?: (payload: Record<string, unknown>) => void
) {
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`${table}_changes`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table,
          filter,
        },
        (payload) => onInsert?.(payload.new as Record<string, unknown>)
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table,
          filter,
        },
        (payload) => onUpdate?.(payload.new as Record<string, unknown>)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, onInsert, onUpdate]);
}
