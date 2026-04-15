"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Percent, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  bulkUpdatePrices,
  updatePriceList,
  upsertPriceListItem,
} from "@/lib/supplier/pricing/actions";
import { formatDate } from "@/lib/utils/formatters";
import type { Database } from "@/types/database";
import type { EditorRow } from "@/components/supplier/pricing/types";
import { PriceListRow } from "@/components/supplier/pricing/price-list-row";

type PriceListDb = Database["public"]["Tables"]["price_lists"]["Row"];

type Props = {
  list: PriceListDb;
  initialRows: EditorRow[];
  missingProductsCount: number;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

const PAGE_SIZE = 50;

export function PriceListEditorClient({
  list,
  initialRows,
  missingProductsCount,
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<EditorRow[]>(initialRows);
  const [statuses, setStatuses] = useState<Record<string, SaveStatus>>({});
  const [page, setPage] = useState(0);
  const [bulkMode, setBulkMode] = useState<"percent" | "fixed">("percent");
  const [bulkValue, setBulkValue] = useState<string>("");
  const [pending, startTransition] = useTransition();

  // Header edit fields
  const [name, setName] = useState(list.name);
  const [validFrom, setValidFrom] = useState(list.valid_from ?? "");
  const [validTo, setValidTo] = useState(list.valid_to ?? "");
  const [isActive, setIsActive] = useState(list.is_active);
  const [isDefault, setIsDefault] = useState(list.is_default);
  const [headerDirty, setHeaderDirty] = useState(false);

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = useMemo(
    () => rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [rows, page],
  );

  const setRowStatus = (id: string, status: SaveStatus) => {
    setStatuses((prev) => ({ ...prev, [id]: status }));
    if (status === "saved") {
      setTimeout(() => {
        setStatuses((prev) => {
          if (prev[id] !== "saved") return prev;
          const { [id]: _drop, ...rest } = prev;
          return rest;
        });
      }, 1800);
    }
  };

  const persistRow = (row: EditorRow, newPrice: number) => {
    setRowStatus(row.id, "saving");
    startTransition(async () => {
      const res = await upsertPriceListItem(list.id, {
        id: row.id,
        product_id: row.product_id,
        sales_unit_id: row.sales_unit_id,
        price: newPrice,
      });
      if (!res.ok) {
        setRowStatus(row.id, "error");
        toast.error(`Errore salvataggio: ${res.error}`);
        return;
      }
      setRowStatus(row.id, "saved");
    });
  };

  const handlePriceChange = (row: EditorRow, rawValue: string) => {
    const parsed = Number.parseFloat(rawValue.replace(",", "."));
    const newPrice = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, price: newPrice } : r)),
    );
    // debounce 600ms
    if (debounceTimers.current[row.id]) {
      clearTimeout(debounceTimers.current[row.id]);
    }
    debounceTimers.current[row.id] = setTimeout(() => {
      persistRow({ ...row, price: newPrice }, newPrice);
    }, 600);
  };

  const handlePriceBlur = (row: EditorRow) => {
    // Flush any pending debounce immediately on blur
    if (debounceTimers.current[row.id]) {
      clearTimeout(debounceTimers.current[row.id]);
      delete debounceTimers.current[row.id];
      const latest = rows.find((r) => r.id === row.id);
      if (latest) persistRow(latest, latest.price);
    }
  };

  const onHeaderSave = () => {
    startTransition(async () => {
      const res = await updatePriceList(list.id, {
        name: name.trim(),
        valid_from: validFrom || null,
        valid_to: validTo || null,
        is_active: isActive,
        is_default: isDefault,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Listino aggiornato");
      setHeaderDirty(false);
      router.refresh();
    });
  };

  const onBulkApply = () => {
    const parsed = Number.parseFloat(bulkValue.replace(",", "."));
    if (!Number.isFinite(parsed)) {
      toast.error("Valore non valido");
      return;
    }
    const label =
      bulkMode === "percent"
        ? `Applicare ${parsed >= 0 ? "+" : ""}${parsed}% a tutti i prezzi?`
        : `Applicare ${parsed >= 0 ? "+" : ""}${parsed}€ a tutti i prezzi?`;
    if (!confirm(label)) return;
    startTransition(async () => {
      const res = await bulkUpdatePrices(list.id, {
        mode: bulkMode,
        value: parsed,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Aggiornate ${res.data} righe`);
      setBulkValue("");
      router.refresh();
    });
  };

  const renderValidity = () => {
    if (!list.valid_from && !list.valid_to) return null;
    const from = list.valid_from ? formatDate(list.valid_from) : "…";
    const to = list.valid_to ? formatDate(list.valid_to) : "…";
    return (
      <span className="text-xs text-text-secondary">
        {from} → {to}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-border-subtle bg-surface-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setHeaderDirty(true);
              }}
              className="text-2xl font-bold text-text-primary bg-transparent border-b border-transparent hover:border-border-subtle focus:border-accent-green focus:outline-none w-full"
            />
            <div className="mt-1 flex items-center gap-3">
              {renderValidity()}
              {list.is_default && (
                <span className="inline-flex items-center rounded-full bg-accent-green/15 text-accent-green px-2 py-0.5 text-xs font-medium">
                  Predefinito
                </span>
              )}
            </div>
          </div>
          {headerDirty && (
            <Button
              size="sm"
              onClick={onHeaderSave}
              disabled={pending || !name.trim()}
            >
              <Save className="h-4 w-4" /> Salva intestazione
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="block">
            <span className="text-xs text-text-secondary">Valido dal</span>
            <input
              type="date"
              value={validFrom ?? ""}
              onChange={(e) => {
                setValidFrom(e.target.value);
                setHeaderDirty(true);
              }}
              className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-sm text-text-primary"
            />
          </label>
          <label className="block">
            <span className="text-xs text-text-secondary">Valido fino al</span>
            <input
              type="date"
              value={validTo ?? ""}
              onChange={(e) => {
                setValidTo(e.target.value);
                setHeaderDirty(true);
              }}
              className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-sm text-text-primary"
            />
          </label>
          <label className="flex items-center gap-2 mt-5">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => {
                setIsActive(e.target.checked);
                setHeaderDirty(true);
              }}
              className="h-4 w-4"
            />
            <span className="text-sm text-text-secondary">Attivo</span>
          </label>
          <label className="flex items-center gap-2 mt-5">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => {
                setIsDefault(e.target.checked);
                setHeaderDirty(true);
              }}
              className="h-4 w-4"
            />
            <span className="text-sm text-text-secondary">Predefinito</span>
          </label>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border-subtle bg-surface-card p-4">
        <div className="flex items-center gap-2">
          <Percent className="h-4 w-4 text-text-secondary" />
          <span className="text-sm font-medium text-text-primary">
            Aggiorna in massa
          </span>
        </div>
        <select
          value={bulkMode}
          onChange={(e) =>
            setBulkMode(e.target.value as "percent" | "fixed")
          }
          className="rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-sm text-text-primary"
        >
          <option value="percent">Variazione %</option>
          <option value="fixed">Variazione fissa €</option>
        </select>
        <input
          type="number"
          step="0.01"
          value={bulkValue}
          onChange={(e) => setBulkValue(e.target.value)}
          placeholder={bulkMode === "percent" ? "Es. 10 o -5" : "Es. 0.50"}
          className="w-40 rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-sm text-text-primary"
        />
        <button
          type="button"
          onClick={onBulkApply}
          disabled={pending || !bulkValue.trim() || rows.length === 0}
          className="px-4 py-2 rounded-lg bg-accent-green text-surface-base text-sm font-medium disabled:opacity-50"
        >
          Applica a {rows.length} righe
        </button>

        <div className="ml-auto">
          <Link href={`/supplier/listini/${list.id}/aggiungi`}>
            <Button size="sm" variant="secondary">
              <Plus className="h-4 w-4" /> Aggiungi prodotti
              {missingProductsCount > 0 && (
                <span className="ml-1 inline-flex items-center rounded-full bg-accent-green/15 text-accent-green px-1.5 py-0.5 text-[10px] font-medium">
                  {missingProductsCount}
                </span>
              )}
            </Button>
          </Link>
        </div>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-surface-card p-10 text-center">
          <p className="text-text-secondary mb-4">
            Questo listino non contiene righe.
          </p>
          <Link href={`/supplier/listini/${list.id}/aggiungi`}>
            <Button size="sm">
              <Plus className="h-4 w-4" /> Aggiungi prodotti
            </Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-base text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                <th className="px-4 py-3">Prodotto</th>
                <th className="px-4 py-3">Unità</th>
                <th className="px-4 py-3 text-right">Prezzo</th>
                <th className="px-4 py-3 w-32 text-right">Stato</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <PriceListRow
                  key={r.id}
                  row={r}
                  status={statuses[r.id] ?? "idle"}
                  onChange={(v) => handlePriceChange(r, v)}
                  onBlur={() => handlePriceBlur(r)}
                />
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border-subtle bg-surface-base px-4 py-3 text-sm">
              <span className="text-text-secondary">
                {page * PAGE_SIZE + 1}–
                {Math.min((page + 1) * PAGE_SIZE, rows.length)} di {rows.length}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 rounded-lg text-text-secondary hover:bg-surface-card disabled:opacity-40"
                >
                  Precedente
                </button>
                <span className="px-3 py-1.5 text-text-primary font-medium">
                  {page + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 rounded-lg text-text-secondary hover:bg-surface-card disabled:opacity-40"
                >
                  Successiva
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
