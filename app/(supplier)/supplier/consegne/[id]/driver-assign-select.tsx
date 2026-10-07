"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { assignDriver } from "@/lib/supplier/delivery/actions";

/**
 * Minimal driver assignment for planners (delivery.plan). Drivers only see
 * the deliveries assigned to them, so without this nobody could reach them.
 */
export function DriverAssignSelect({
  deliveryId,
  currentDriverId,
  options,
}: {
  deliveryId: string;
  currentDriverId: string | null;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentDriverId ?? "");
  const [pending, startTransition] = useTransition();

  function onChange(next: string) {
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const res = await assignDriver({
        deliveryId,
        driverMemberId: next || null,
      });
      if (!res.ok) {
        setValue(previous);
        toast.error(res.error);
        return;
      }
      toast.success(next ? "Autista assegnato" : "Assegnazione rimossa");
      router.refresh();
    });
  }

  return (
    <Select
      label="Autista"
      value={value}
      disabled={pending}
      onChange={(e) => onChange(e.target.value)}
      options={[{ value: "", label: "Nessun autista assegnato" }, ...options]}
    />
  );
}
