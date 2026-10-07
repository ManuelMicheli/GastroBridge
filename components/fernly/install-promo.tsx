"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils/formatters";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// The browser fires `beforeinstallprompt` once, possibly before React mounts:
// capture it at module load and fan it out to subscribers.
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

function useInstallPrompt() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return deferred;
}

/**
 * Sidebar promo card — "GastroBridge su iPhone & Android". Rendered only
 * when the browser actually offers the PWA install prompt (manifest at
 * /manifest.webmanifest); otherwise nothing is shown.
 */
export function InstallPromo({ collapsed = false }: { collapsed?: boolean }) {
  const prompt = useInstallPrompt();
  if (!prompt) return null;

  async function install() {
    const p = deferred;
    if (!p) return;
    await p.prompt();
    try {
      await p.userChoice;
    } finally {
      deferred = null;
      listeners.forEach((l) => l());
    }
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={install}
        className="f-deep mx-auto flex h-11 w-11 items-center justify-center rounded-[14px]"
        title="Installa GastroBridge"
        aria-label="Installa GastroBridge"
      >
        <Download className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className={cn("f-deep f-rise relative overflow-hidden rounded-[18px] p-4")} style={{ ["--i" as string]: 3 }}>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[var(--acc-900)]">
        <Smartphone className="h-4 w-4" />
      </span>
      <p className="mt-3 text-[15px] font-medium leading-[1.25] text-white">
        GastroBridge su
        <br />
        iPhone &amp; Android
      </p>
      <p className="mt-1 text-[12px] text-white/65">Ordina dalla cucina</p>
      <button type="button" onClick={install} className="f-btn f-btn-sm f-btn-block mt-4 !bg-[var(--acc-800)] !text-white hover:!bg-[var(--acc-700)]">
        Installa
      </button>
    </div>
  );
}
