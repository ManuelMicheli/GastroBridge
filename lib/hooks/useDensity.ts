"use client";

import { useCallback, useEffect, useState } from "react";

export type Density = "compact" | "cozy" | "editorial";

/**
 * Per-table density preference, persisted to localStorage under
 * `gb:density:<tableId>`. Defaults to "cozy".
 */
export function useDensity(
  tableId: string,
  defaultDensity: Density = "cozy",
): { density: Density; setDensity: (d: Density) => void } {
  const storageKey = `gb:density:${tableId}`;
  const [density, setDensityState] = useState<Density>(defaultDensity);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(storageKey);
    if (saved === "compact" || saved === "cozy" || saved === "editorial") {
      setDensityState(saved);
    }
  }, [storageKey]);

  const setDensity = useCallback(
    (d: Density) => {
      setDensityState(d);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, d);
      }
    },
    [storageKey],
  );

  return { density, setDensity };
}
