"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Store } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { FCard, IconTile } from "@/components/fernly/primitives";
import { switchActiveRestaurant } from "@/lib/restaurants/team/actions";
import { cn } from "@/lib/utils/formatters";

export type SwitcherRestaurant = {
  id: string;
  name: string;
  roleLabel: string;
  isOwner: boolean;
};

/** "I tuoi ristoranti": pick the restaurant the whole app works on. */
export function RestaurantSwitcher({
  activeId,
  restaurants,
}: {
  activeId: string;
  restaurants: SwitcherRestaurant[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function pick(r: SwitcherRestaurant) {
    if (r.id === activeId || pending) return;
    startTransition(async () => {
      const res = await switchActiveRestaurant(r.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Ora lavori su ${r.name}`);
      router.refresh();
    });
  }

  return (
    <FCard title="I tuoi ristoranti" index={2}>
      <p className="-mt-2 mb-3 text-[13px] text-[var(--f-muted)]">
        Scegli su quale ristorante lavorare: ordini, cataloghi e fornitori seguono questa scelta.
      </p>
      <ul className="flex flex-col gap-2" role="radiogroup" aria-label="Ristorante attivo">
        {restaurants.map((r) => {
          const active = r.id === activeId;
          return (
            <li key={r.id}>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                disabled={pending}
                onClick={() => pick(r)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[14px] border px-3 py-2.5 text-left transition-[border-color,box-shadow] duration-200 disabled:opacity-60",
                  active
                    ? "border-[var(--f-ink)] shadow-[0_0_0_1px_var(--f-ink)]"
                    : "border-[var(--f-line-strong)] hover:border-[var(--f-ink-2)]",
                )}
              >
                <IconTile seed={r.id}>
                  <Store className="h-4 w-4" aria-hidden />
                </IconTile>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-[var(--f-ink)]">{r.name}</span>
                  <span className="block text-[12.5px] text-[var(--f-muted)]">
                    {r.isOwner ? "Di tua proprietà" : `Membro · ${r.roleLabel}`}
                  </span>
                </span>
                {active ? (
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--acc-800)] text-white">
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </FCard>
  );
}
