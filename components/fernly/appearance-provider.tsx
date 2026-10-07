"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  accentKey,
  applyAccentToDocument,
  DEFAULT_ACCENT,
  DEFAULT_WEEK_START,
  readStoredAccent,
  readStoredWeekStart,
  weekStartKey,
  type AccentId,
  type AppArea,
  type WeekStart,
} from "@/lib/appearance";

type Ctx = {
  area: AppArea;
  accent: AccentId;
  setAccent: (a: AccentId) => void;
  weekStart: WeekStart;
  setWeekStart: (w: WeekStart) => void;
};

const AppearanceContext = createContext<Ctx | null>(null);

export function AppearanceProvider({ area, children }: { area: AppArea; children: ReactNode }) {
  const [accent, setAccentState] = useState<AccentId>(DEFAULT_ACCENT[area]);
  const [weekStart, setWeekStartState] = useState<WeekStart>(DEFAULT_WEEK_START);

  // Hydrate from storage (the boot script already painted the right accent).
  useEffect(() => {
    const a = readStoredAccent(area);
    setAccentState(a);
    setWeekStartState(readStoredWeekStart(area));
    applyAccentToDocument(area, a);
  }, [area]);

  const setAccent = useCallback(
    (a: AccentId) => {
      setAccentState(a);
      applyAccentToDocument(area, a);
      try {
        window.localStorage.setItem(accentKey(area), a);
      } catch {
        /* private mode — the choice still applies for this session */
      }
    },
    [area],
  );

  const setWeekStart = useCallback(
    (w: WeekStart) => {
      setWeekStartState(w);
      try {
        window.localStorage.setItem(weekStartKey(area), w);
      } catch {
        /* ignore */
      }
    },
    [area],
  );

  const value = useMemo(
    () => ({ area, accent, setAccent, weekStart, setWeekStart }),
    [area, accent, setAccent, weekStart, setWeekStart],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

/** Appearance context; falls back to defaults outside the app shell. */
export function useAppearance(): Ctx {
  const ctx = useContext(AppearanceContext);
  if (ctx) return ctx;
  return {
    area: "restaurant",
    accent: DEFAULT_ACCENT.restaurant,
    setAccent: () => {},
    weekStart: DEFAULT_WEEK_START,
    setWeekStart: () => {},
  };
}

/** 0 = Sunday, 1 = Monday — for date-fns `weekStartsOn`. */
export function useWeekStartsOn(): 0 | 1 {
  return useAppearance().weekStart === "sun" ? 0 : 1;
}
