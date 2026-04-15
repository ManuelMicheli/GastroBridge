"use client";

import { Trash2, Plus } from "lucide-react";
import type { DeliverySlotInput } from "@/lib/supplier/delivery-zones/schemas";

type Props = {
  slots: DeliverySlotInput[];
  onChange: (next: DeliverySlotInput[]) => void;
  disabled?: boolean;
};

export function SlotEditor({ slots, onChange, disabled }: Props) {
  const update = (idx: number, patch: Partial<DeliverySlotInput>) => {
    const next = slots.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange(next);
  };

  const remove = (idx: number) => {
    onChange(slots.filter((_, i) => i !== idx));
  };

  const add = () => {
    onChange([
      ...slots,
      { from: "08:00", to: "12:00", label: "", capacity: 10 },
    ]);
  };

  return (
    <div className="space-y-2">
      {slots.length === 0 ? (
        <p className="text-xs text-text-secondary italic">
          Nessuno slot. Aggiungi almeno una fascia oraria.
        </p>
      ) : (
        <div className="space-y-2">
          {slots.map((slot, idx) => (
            <div
              key={idx}
              className="grid grid-cols-[1fr_1fr_2fr_1fr_auto] gap-2 items-end"
            >
              <label className="block">
                <span className="text-[11px] text-text-secondary">Da</span>
                <input
                  type="time"
                  value={slot.from}
                  onChange={(e) => update(idx, { from: e.target.value })}
                  disabled={disabled}
                  className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-2 py-1.5 text-sm text-text-primary"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-text-secondary">A</span>
                <input
                  type="time"
                  value={slot.to}
                  onChange={(e) => update(idx, { to: e.target.value })}
                  disabled={disabled}
                  className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-2 py-1.5 text-sm text-text-primary"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-text-secondary">
                  Etichetta
                </span>
                <input
                  type="text"
                  value={slot.label ?? ""}
                  maxLength={40}
                  onChange={(e) => update(idx, { label: e.target.value })}
                  disabled={disabled}
                  placeholder="Es. Mattina"
                  className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-2 py-1.5 text-sm text-text-primary"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-text-secondary">
                  Capacità
                </span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={slot.capacity}
                  onChange={(e) =>
                    update(idx, {
                      capacity: Number.parseInt(e.target.value, 10) || 1,
                    })
                  }
                  disabled={disabled}
                  className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-2 py-1.5 text-sm text-text-primary"
                />
              </label>
              <button
                type="button"
                onClick={() => remove(idx)}
                disabled={disabled}
                className="p-1.5 rounded-lg hover:bg-red-50 text-sage hover:text-red-600 disabled:opacity-40"
                aria-label="Rimuovi slot"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={add}
        disabled={disabled}
        className="inline-flex items-center gap-1 text-xs text-accent-green hover:underline disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" /> Aggiungi slot
      </button>
    </div>
  );
}
