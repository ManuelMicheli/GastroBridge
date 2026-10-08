"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { switchActiveRestaurant } from "@/lib/restaurants/team/actions";

/** Compact "Sede" picker: switches the restaurant the whole app works on. */
export function SedeSwitcher({ activeId, restaurants }: { activeId: string; restaurants: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center gap-2">
      <span className="text-[12.5px] text-[var(--f-muted)]">Sede</span>
      <select
        className="f-input !h-9 !w-auto !text-[13px]"
        value={activeId}
        disabled={pending}
        onChange={(e) => {
          const id = e.target.value;
          start(async () => {
            const res = await switchActiveRestaurant(id);
            if (!res.ok) toast.error(res.error);
            else router.refresh();
          });
        }}
      >
        {restaurants.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    </label>
  );
}
