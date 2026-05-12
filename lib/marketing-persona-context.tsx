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
const URL_PARAM = "persona";

type PersonaContextValue = {
  persona: Persona;
  setPersona: (next: Persona) => void;
  toggle: () => void;
  hydrated: boolean;
};

const PersonaContext = createContext<PersonaContextValue | null>(null);

function isPersona(v: unknown): v is Persona {
  return v === "restaurant" || v === "supplier";
}

function readStoredPersona(): Persona | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isPersona(raw) ? raw : null;
  } catch {
    return null;
  }
}

function readUrlPersona(): Persona | null {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get(URL_PARAM);
    return isPersona(raw) ? raw : null;
  } catch {
    return null;
  }
}

function applyDocumentPersona(value: Persona) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.persona = value;
}

function writeUrlPersona(value: Persona) {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set(URL_PARAM, value);
    window.history.replaceState(window.history.state, "", url.toString());
  } catch {
    // ignore — non-critical
  }
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
    const fromUrl = readUrlPersona();
    const fromStorage = readStoredPersona();
    const resolved = fromUrl ?? fromStorage ?? persona;
    if (resolved !== persona) setPersonaState(resolved);
    applyDocumentPersona(resolved);
    if (fromUrl) {
      try {
        window.localStorage.setItem(STORAGE_KEY, fromUrl);
      } catch {
        // ignore
      }
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
      const apply = () => {
        applyDocumentPersona(next);
        writeUrlPersona(next);
      };
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
