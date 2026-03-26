"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <AlertTriangle className="h-12 w-12 text-terracotta mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-charcoal mb-2">
          Qualcosa e andato storto
        </h2>
        <p className="text-sage mb-6">
          Si e verificato un errore inatteso. Riprova o torna alla pagina
          principale.
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={reset} variant="primary">
            Riprova
          </Button>
          <Button
            onClick={() => (window.location.href = "/")}
            variant="secondary"
          >
            Torna alla Home
          </Button>
        </div>
      </div>
    </div>
  );
}
