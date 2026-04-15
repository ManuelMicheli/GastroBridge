"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Plus, Trash2, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/formatters";
import type { Database } from "@/types/database";
import {
  upsertSalesUnits,
  deleteSalesUnit,
} from "@/lib/supplier/catalog/actions";
import type { SalesUnitInput } from "@/lib/supplier/catalog/schemas";

type SalesUnitRow = Database["public"]["Tables"]["product_sales_units"]["Row"];

// Allowed unit_type values per SalesUnitSchema (subset of UnitType).
const UNIT_TYPE_OPTIONS = [
  { value: "piece", label: "Pezzo" },
  { value: "kg", label: "Chilogrammo (kg)" },
  { value: "g", label: "Grammo (g)" },
  { value: "l", label: "Litro (l)" },
  { value: "ml", label: "Millilitro (ml)" },
  { value: "box", label: "Cartone / Box" },
  { value: "pallet", label: "Pallet" },
  { value: "bundle", label: "Bundle" },
  { value: "other", label: "Altro" },
];

type EditableRow = {
  // clientKey is stable across re-orders; id exists only for persisted rows.
  clientKey: string;
  id?: string;
  label: string;
  unit_type: SalesUnitInput["unit_type"];
  conversion_to_base: string;
  is_base: boolean;
  barcode: string;
  moq: string;
  sort_order: number;
  is_active: boolean;
};

function rowFromDb(r: SalesUnitRow): EditableRow {
  return {
    clientKey: r.id,
    id: r.id,
    label: r.label,
    unit_type: (UNIT_TYPE_OPTIONS.some((o) => o.value === r.unit_type)
      ? r.unit_type
      : "other") as SalesUnitInput["unit_type"],
    conversion_to_base: String(r.conversion_to_base ?? 1),
    is_base: r.is_base,
    barcode: r.barcode ?? "",
    moq: String(r.moq ?? 1),
    sort_order: r.sort_order ?? 0,
    is_active: r.is_active,
  };
}

let keyCounter = 0;
function newKey() {
  keyCounter += 1;
  return `new-${Date.now()}-${keyCounter}`;
}

export default function SalesUnitsEditor({
  productId,
  initialUnits,
  productPrice,
}: {
  productId: string;
  initialUnits: SalesUnitRow[];
  productPrice: number;
}) {
  const [rows, setRows] = useState<EditableRow[]>(() =>
    initialUnits.length > 0
      ? initialUnits.map(rowFromDb)
      : [
          {
            clientKey: newKey(),
            label: "Pezzo base",
            unit_type: "piece",
            conversion_to_base: "1",
            is_base: true,
            barcode: "",
            moq: "1",
            sort_order: 0,
            is_active: true,
          },
        ],
  );
  const [isPending, startTransition] = useTransition();

  const baseRow = useMemo(() => rows.find((r) => r.is_base) ?? null, [rows]);
  const basePriceNum = Number(productPrice) || 0;

  function updateRow(key: string, patch: Partial<EditableRow>) {
    setRows((prev) =>
      prev.map((r) => (r.clientKey === key ? { ...r, ...patch } : r)),
    );
  }

  function setBase(key: string) {
    setRows((prev) =>
      prev.map((r) => ({ ...r, is_base: r.clientKey === key })),
    );
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        clientKey: newKey(),
        label: "",
        unit_type: "box",
        conversion_to_base: "1",
        is_base: false,
        barcode: "",
        moq: "1",
        sort_order: prev.length,
        is_active: true,
      },
    ]);
  }

  function duplicateRow(key: string) {
    setRows((prev) => {
      const source = prev.find((r) => r.clientKey === key);
      if (!source) return prev;
      const idx = prev.indexOf(source);
      const copy: EditableRow = {
        clientKey: newKey(),
        id: undefined,
        label: `${source.label} (copia)`.trim(),
        unit_type: source.unit_type,
        conversion_to_base: source.conversion_to_base,
        is_base: false,
        barcode: source.barcode,
        moq: source.moq,
        sort_order: prev.length,
        is_active: source.is_active,
      };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next.map((r, i) => ({ ...r, sort_order: i }));
    });
  }

  async function removeRow(key: string) {
    const row = rows.find((r) => r.clientKey === key);
    if (!row) return;
    if (row.is_base) {
      toast.error("Impossibile eliminare l'unità base");
      return;
    }
    // Not persisted → just drop locally.
    if (!row.id) {
      setRows((prev) => prev.filter((r) => r.clientKey !== key));
      return;
    }
    startTransition(async () => {
      const res = await deleteSalesUnit(productId, row.id!);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRows((prev) => prev.filter((r) => r.clientKey !== key));
      toast.success("Unità eliminata");
    });
  }

  function handleSave() {
    // Pre-validate: 1 base, labels, positive conversion.
    const bases = rows.filter((r) => r.is_base);
    if (bases.length !== 1) {
      toast.error("Seleziona esattamente una unità come base");
      return;
    }
    for (const r of rows) {
      if (!r.label.trim()) {
        toast.error("Ogni unità deve avere un'etichetta");
        return;
      }
      const conv = Number(r.conversion_to_base);
      if (!Number.isFinite(conv) || conv <= 0) {
        toast.error(`Conversione non valida per "${r.label}"`);
        return;
      }
      const moq = Number(r.moq);
      if (!Number.isFinite(moq) || moq <= 0) {
        toast.error(`MOQ non valido per "${r.label}"`);
        return;
      }
    }

    const payload: SalesUnitInput[] = rows.map((r, i) => ({
      id: r.id,
      label: r.label.trim(),
      unit_type: r.unit_type,
      conversion_to_base: Number(r.conversion_to_base),
      is_base: r.is_base,
      barcode: r.barcode.trim() || null,
      moq: Number(r.moq),
      sort_order: i,
      is_active: r.is_active,
    }));

    startTransition(async () => {
      const res = await upsertSalesUnits(productId, payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRows(res.data.map(rowFromDb));
      toast.success("Unità di vendita salvate");
    });
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-charcoal">Unità di vendita</h2>
          <p className="text-sm text-sage">
            Definisci come viene venduto il prodotto. Esattamente una riga deve
            essere l&apos;unità base (conversione = 1).
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={addRow}
          disabled={isPending}
        >
          <Plus className="h-4 w-4" /> Aggiungi unità
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-sage uppercase tracking-wider border-b border-sage-muted/40">
              <th className="py-2 pr-3">Base</th>
              <th className="py-2 pr-3">Etichetta</th>
              <th className="py-2 pr-3">Tipo</th>
              <th className="py-2 pr-3">Conv. → base</th>
              <th className="py-2 pr-3">MOQ</th>
              <th className="py-2 pr-3">Barcode</th>
              <th className="py-2 pr-3">Attiva</th>
              <th className="py-2 pr-3 text-right">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const conv = Number(r.conversion_to_base);
              const perUnitHint =
                basePriceNum > 0 && Number.isFinite(conv) && conv > 0
                  ? `${(basePriceNum * conv).toFixed(2)} €/${r.label || "unità"}${
                      baseRow && baseRow.clientKey !== r.clientKey
                        ? ` (≈ ${basePriceNum.toFixed(2)} €/${baseRow.label || "base"})`
                        : ""
                    }`
                  : null;
              return (
                <tr
                  key={r.clientKey}
                  className={cn(
                    "border-b border-sage-muted/20 align-top",
                    r.is_base && "bg-forest-light/30",
                  )}
                >
                  <td className="py-3 pr-3">
                    <input
                      type="radio"
                      name="base-unit"
                      checked={r.is_base}
                      onChange={() => setBase(r.clientKey)}
                      disabled={isPending}
                      className="h-4 w-4 accent-forest"
                      aria-label={`Imposta ${r.label || "riga"} come base`}
                    />
                  </td>
                  <td className="py-3 pr-3">
                    <Input
                      value={r.label}
                      onChange={(e) =>
                        updateRow(r.clientKey, { label: e.target.value })
                      }
                      placeholder="Es. Bottiglia 750ml"
                      className="py-2"
                      disabled={isPending}
                    />
                    {perUnitHint && (
                      <p className="text-xs text-sage mt-1">{perUnitHint}</p>
                    )}
                  </td>
                  <td className="py-3 pr-3 min-w-[160px]">
                    <Select
                      value={r.unit_type}
                      onChange={(e) =>
                        updateRow(r.clientKey, {
                          unit_type: e.target
                            .value as SalesUnitInput["unit_type"],
                        })
                      }
                      options={UNIT_TYPE_OPTIONS}
                      className="py-2"
                      disabled={isPending}
                    />
                  </td>
                  <td className="py-3 pr-3 w-32">
                    <Input
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      value={r.is_base ? "1" : r.conversion_to_base}
                      onChange={(e) =>
                        updateRow(r.clientKey, {
                          conversion_to_base: e.target.value,
                        })
                      }
                      className="py-2"
                      disabled={isPending || r.is_base}
                    />
                  </td>
                  <td className="py-3 pr-3 w-24">
                    <Input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={r.moq}
                      onChange={(e) =>
                        updateRow(r.clientKey, { moq: e.target.value })
                      }
                      className="py-2"
                      disabled={isPending}
                    />
                  </td>
                  <td className="py-3 pr-3">
                    <Input
                      value={r.barcode}
                      onChange={(e) =>
                        updateRow(r.clientKey, { barcode: e.target.value })
                      }
                      placeholder="EAN/GTIN"
                      className="py-2"
                      disabled={isPending}
                    />
                  </td>
                  <td className="py-3 pr-3">
                    <input
                      type="checkbox"
                      checked={r.is_active}
                      onChange={(e) =>
                        updateRow(r.clientKey, { is_active: e.target.checked })
                      }
                      disabled={isPending}
                      className="h-4 w-4 accent-forest"
                    />
                  </td>
                  <td className="py-3 pr-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => duplicateRow(r.clientKey)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 text-sage hover:text-forest text-xs mr-3 disabled:opacity-40"
                      title="Duplica"
                    >
                      <Copy className="h-4 w-4" /> Duplica
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(r.clientKey)}
                      disabled={isPending || r.is_base}
                      className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 text-xs disabled:opacity-40"
                      title={
                        r.is_base
                          ? "L'unità base non può essere eliminata"
                          : "Elimina"
                      }
                    >
                      {r.is_base ? (
                        <Lock className="h-4 w-4" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Elimina
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-sage-muted/30">
        {isPending && (
          <span className="text-sm text-sage inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Operazione in corso…
          </span>
        )}
        <Button type="button" onClick={handleSave} disabled={isPending}>
          {isPending ? "Salvataggio…" : "Salva unità"}
        </Button>
      </div>
    </Card>
  );
}
