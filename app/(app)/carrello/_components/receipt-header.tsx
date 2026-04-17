"use client";

import { format } from "date-fns";
import { useEffect, useState } from "react";

type Props = {
  restaurantName: string | null;
};

/**
 * Top of the receipt: brand line + dashed rule + date · time + restaurant.
 * The timestamp updates once on mount so server/client rendering agree even
 * though the time itself is client-local.
 */
export function ReceiptHeader({ restaurantName }: Props) {
  const [now, setNow] = useState<string>("");

  useEffect(() => {
    setNow(format(new Date(), "yyyy-MM-dd · HH:mm"));
  }, []);

  return (
    <header className="px-6 pt-6 pb-5 text-center font-mono">
      <p className="text-[12px] uppercase tracking-[0.2em] text-text-primary font-semibold">
        GASTROBRIDGE ORDER
      </p>
      <p
        aria-hidden="true"
        className="mt-1 text-[11px] tracking-[0.05em] text-text-tertiary select-none"
      >
        ──────────────────
      </p>
      <p className="mt-2 text-[11px] tabular-nums text-text-secondary">
        {now || "\u00a0"}
      </p>
      {restaurantName && (
        <p className="mt-1 text-[12px] text-text-primary truncate">
          {restaurantName}
        </p>
      )}
    </header>
  );
}
