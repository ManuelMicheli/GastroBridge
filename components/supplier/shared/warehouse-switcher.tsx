"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Warehouse } from "lucide-react";

export type WarehouseOption = {
  id: string;
  name: string;
  isPrimary: boolean;
};

type Props = {
  warehouses: WarehouseOption[];
  currentWarehouseId?: string | null;
  /** Opzionale: callback custom al cambio selezione (altrimenti aggiorna ?warehouse=<id>) */
  onChange?: (warehouseId: string) => void;
};

/**
 * WarehouseSwitcher — selettore magazzino attivo per le pagine `/supplier/magazzino/*`.
 *
 * Disclosure progressivo: se il fornitore ha **un solo magazzino**, il componente
 * non viene renderizzato (ritorna `null`). L'utente con piano "basic" non vede
 * nulla di complesso; chi ha >1 sede vede un dropdown dark-dashboard che
 * aggiorna il query param `?warehouse=<id>` via `router.replace` (scroll:false),
 * così la selezione è persistente, condivisibile e SSR-friendly.
 */
export function WarehouseSwitcher({
  warehouses,
  currentWarehouseId,
  onChange,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  // Se c'è <=1 magazzino non mostriamo il selettore.
  if (warehouses.length <= 1) return null;

  const selected =
    currentWarehouseId ??
    searchParams?.get("warehouse") ??
    warehouses.find((w) => w.isPrimary)?.id ??
    warehouses[0]?.id ??
    "";

  const handleChange = (value: string) => {
    if (onChange) {
      onChange(value);
      return;
    }
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("warehouse", value);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <label className="flex items-center gap-2 text-sm text-sage">
      <Warehouse className="h-4 w-4 text-accent-green" aria-hidden />
      <span className="hidden md:inline">Sede:</span>
      <select
        value={selected}
        onChange={(e) => handleChange(e.target.value)}
        disabled={pending}
        className="rounded-md border border-smoke/40 bg-carbon px-3 py-1.5 text-sm text-charcoal focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green disabled:opacity-60"
        aria-label="Seleziona sede/magazzino"
      >
        {warehouses.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
            {w.isPrimary ? " (principale)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
