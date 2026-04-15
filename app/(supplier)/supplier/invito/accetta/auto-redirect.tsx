"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function AutoRedirect({
  to,
  delayMs = 2000,
}: {
  to: string;
  delayMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    toast.success("Invito accettato con successo");
    const id = setTimeout(() => {
      router.push(to);
      router.refresh();
    }, delayMs);
    return () => clearTimeout(id);
  }, [router, to, delayMs]);

  return null;
}
