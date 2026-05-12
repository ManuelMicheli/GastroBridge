"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export type Persona = "restaurant" | "supplier";

const STORAGE_KEY = "gbr.marketing.persona";

type PersonaContextValue = {
  persona: Persona;
  setPersona: (next: Persona) => void;
  toggle: () => void;
  hydrated: boolean;
};

const PersonaContext = createContext<PersonaContextValue | null>(null);

function readStoredPersona(): Persona | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === "restaurant" || raw === "supplier" ? raw : null;
  } catch {
    return null;
  }
}

function applyDocumentPersona(value: Persona) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.persona = value;
}

export function PersonaProvider({
  children,
  initial = "restaurant",
}: {
  children: ReactNode;
  initial?: Persona;
}) {
  const [persona, setPersonaState] = useState<Persona>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStoredPersona();
    if (stored && stored !== persona) {
      setPersonaState(stored);
      applyDocumentPersona(stored);
    } else {
      applyDocumentPersona(persona);
    }
    setHydrated(true);
  }, []);

  const setPersona = useCallback((next: Persona) => {
    setPersonaState((prev) => {
      if (prev === next) return prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore quota errors
      }
      const apply = () => applyDocumentPersona(next);
      const vt = (document as Document & {
        startViewTransition?: (cb: () => void) => unknown;
      }).startViewTransition;
      if (typeof vt === "function") {
        vt.call(document, apply);
      } else {
        apply();
      }
      return next;
    });
  }, []);

  const toggle = useCallback(() => {
    setPersona(persona === "restaurant" ? "supplier" : "restaurant");
  }, [persona, setPersona]);

  return (
    <PersonaContext.Provider value={{ persona, setPersona, toggle, hydrated }}>
      {children}
    </PersonaContext.Provider>
  );
}

export function usePersona(): PersonaContextValue {
  const ctx = useContext(PersonaContext);
  if (!ctx) {
    throw new Error("usePersona must be used inside <PersonaProvider />");
  }
  return ctx;
}
