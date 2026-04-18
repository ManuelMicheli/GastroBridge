"use client";

import { useEffect, useState } from "react";
import { useOnEvent } from "@/lib/realtime/supplier-hooks";

/**
 * Returns a className applied to a row while it's being flash-highlighted
 * (pulse animation after an order split update lands).
 *
 * Usage in a consumer:
 *
 *   const className = useFlashOnSplitUpdate(row.splitId);
 *   return <tr className={cn(baseClassName, className)}> … </tr>
 */
export function useFlashOnSplitUpdate(splitId: string | null | undefined): string {
  const [active, setActive] = useState(false);

  useOnEvent(
    (event) => {
      if (!splitId) return;
      if (event.splitId !== splitId) return;
      setActive(true);
      const t = setTimeout(() => setActive(false), 1500);
      return () => clearTimeout(t);
    },
    ["order_received", "order_accepted", "order_shipped", "order_delivered", "order_split_updated"],
  );

  return active ? "rt-flash-highlight" : "";
}

/**
 * Declarative wrapper — apply a class to any child when an event matches.
 *
 * <FlashOnSplitUpdate splitId={row.splitId}>
 *   <tr> … </tr>
 * </FlashOnSplitUpdate>
 */
export function FlashOnSplitUpdate({
  splitId,
  children,
  duration = 1500,
}: {
  splitId: string;
  children: (activeClassName: string) => React.ReactNode;
  duration?: number;
}) {
  const [active, setActive] = useState(false);

  useOnEvent(
    (event) => {
      if (event.splitId !== splitId) return;
      setActive(true);
    },
    ["order_received", "order_accepted", "order_shipped", "order_delivered", "order_split_updated"],
  );

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setActive(false), duration);
    return () => clearTimeout(t);
  }, [active, duration]);

  return <>{children(active ? "rt-flash-highlight" : "")}</>;
}
