"use client";

import { useEffect } from "react";
import { RouteErrorView } from "@/components/fernly/route-states";

export default function SupplierError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <RouteErrorView reset={reset} homeHref="/supplier/dashboard" digest={error.digest} />;
}
