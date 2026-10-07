"use client";

import { useEffect } from "react";
import { RouteErrorView } from "@/components/fernly/route-states";

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
    <div className="min-h-screen bg-[var(--f-canvas,#ECEEED)]">
      <RouteErrorView reset={reset} homeHref="/" homeLabel="Torna alla home" digest={error.digest} />
    </div>
  );
}
