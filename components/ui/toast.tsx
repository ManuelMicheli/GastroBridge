"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        style: {
          fontFamily: "var(--font-body)",
          borderRadius: "0.75rem",
        },
        classNames: {
          success: "!bg-forest-light !text-forest-dark !border-forest/20",
          error: "!bg-red-50 !text-red-800 !border-red-200",
          warning:
            "!bg-terracotta-light !text-terracotta !border-terracotta/20",
          info: "!bg-sage-muted !text-charcoal !border-sage/20",
        },
      }}
    />
  );
}

export { toast } from "sonner";
