"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ClipboardList, Pencil, Warehouse } from "lucide-react";
import { adjustStock } from "@/lib/supplier/stock/actions";

type WarehouseOption = {
  id: string;
  name: string;
  isPrimary: boolean;
};

type OverviewRow = {
  productId: string;
  productName: string;
  warehouseId: string;
  quantityBase: number;
  availableBase: number;
};

type LotRow = {
  id: string;
  productId: string;
  productName: string;
  lotCode: string;
  expiryDate: string | null;
  quantityBase: number;
  quantityReservedBase: number;
};

type ReasonCode =
  | "conteggio fisico"
  | "danneggiamento"
  | "scaduto"
  | "smarrito"
  | "altro";

const REASONS: { value: ReasonCode; label: string }[] = [
  { value: "conteggio fisico", label: "Conteggio fisico" },
  { value: "danneggiamento", label: "Danneggiamento" },
  { value: "scaduto", label: "Scaduto" },
  { value: "smarrito", label: "Smarrito / sottratto" },
  { value: "altro", label: "Altro" },
];

type Tab = "quick" | "count";

type Props = {
  supplierId: string;
  warehouses: WarehouseOption[];
  selectedWarehouseId: string | null;
  overview: OverviewRow[];
  lots: LotRow[];
};

function formatNumber(n: number): string {
  return Number.isInteger(n)
    ? n.toString()
    : n.toFixed(3).replace(/\.?0+$/, "");
}

export function InventarioClient({
  supplierId,
  warehouses,
  selectedWarehouseId,
  overview,
  lots,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<Tab>("quick");

  const warehouseId =
    selectedWarehouseId ?? warehouses[0]?.id ?? null;

  const changeWarehouse = (id: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("warehouse", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-4">
      {warehouses.length > 1 && (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Warehouse className="h-4 w-4 text-accent-green" aria-hidden />
          <span>Sede:</span>
          <select
            value={warehouseId ?? ""}
            onChange={(e) => changeWarehouse(e.target.value)}
            className="rounded-md border border-border-subtle bg-surface-base px-3 py-1.5 text-sm text-text-primary focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
            aria-label="Seleziona sede"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {w.isPrimary ? " (principale)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex gap-1 border-b border-border-subtle">
        <button
          type="button"
          onClick={() => setTab("quick")}
          className={`flex items-center gap-2 rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "quick"
              ? "border-b-2 border-accent-green bg-accent-green/10 text-accent-green"
              : "text-text-secondary hover:text-text-primary"
          }`}
          aria-current={tab === "quick" ? "page" : undefined}
        >
          <Pencil className="h-4 w-4" aria-hidden />
          Rettifica rapida
        </button>
        <button
          type="button"
          onClick={() => setTab("count")}
          className={`flex items-center gap-2 rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "count"
              ? "border-b-2 border-accent-green bg-accent-green/10 text-accent-green"
              : "text-text-secondary hover:text-text-primary"
          }`}
          aria-current={tab === "count" ? "page" : undefined}
        >
          <ClipboardList className="h-4 w-4" aria-hidden />
          Inventario fisico
        </button>
      </div>

      {warehouseId && tab === "quick" && (
        <QuickAdjustForm
          supplierId={supplierId}
          warehouseId={warehouseId}
          overview={overview}
          lots={lots}
        />
      )}

      {warehouseId && tab === "count" && (
        <PhysicalCountForm
          supplierId={supplierId}
          warehouseId={warehouseId}
          overview={overview}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rettifica rapida — form singolo
// ---------------------------------------------------------------------------

function QuickAdjustForm({
  supplierId,
  warehouseId,
  overview,
  lots,
}: {
  supplierId: string;
  warehouseId: string;
  overview: OverviewRow[];
  lots: LotRow[];
}) {
  const [productId, setProductId] = useState<string>("");
  const [lotId, setLotId] = useState<string>("");
  const [delta, setDelta] = useState<string>("");
  const [reasonCode, setReasonCode] = useState<ReasonCode>("conteggio fisico");
  const [note, setNote] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const productOptions = useMemo(
    () =>
      [...overview].sort((a, b) =>
        a.productName.localeCompare(b.productName),
      ),
    [overview],
  );

  const lotOptions = useMemo(
    () =>
      lots
        .filter((l) => (productId ? l.productId === productId : false))
        .sort((a, b) => {
          const da = a.expiryDate ?? "9999-99-99";
          const db = b.expiryDate ?? "9999-99-99";
          return da.localeCompare(db);
        }),
    [lots, productId],
  );

  const currentOverview = overview.find((o) => o.productId === productId);

  const deltaNum = Number(delta);
  const deltaValid = delta.trim().length > 0 && Number.isFinite(deltaNum) && deltaNum !== 0;

  const submit = () => {
    if (!productId) {
      toast.error("Seleziona un prodotto");
      return;
    }
    if (!deltaValid) {
      toast.error("Delta deve essere un numero diverso da zero");
      return;
    }
    const trimmedNote = note.trim();
    const reason = trimmedNote
      ? `${reasonCode} — ${trimmedNote}`
      : reasonCode;
    if (reason.length < 3) {
      toast.error("Motivo troppo corto");
      return;
    }

    startTransition(async () => {
      const res = await adjustStock({
        supplierId,
        warehouseId,
        productId,
        lotId: lotId || null,
        deltaBase: deltaNum,
        reason,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const sign = deltaNum > 0 ? "+" : "";
      const count = res.data.movementIds.length;
      toast.success(
        count === 1
          ? `Rettifica applicata (${sign}${formatNumber(deltaNum)})`
          : `Rettifica FEFO applicata su ${count} lotti (${sign}${formatNumber(deltaNum)})`,
      );
      // Reset
      setDelta("");
      setNote("");
      setLotId("");
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-4 rounded-lg border border-border-subtle bg-surface-card p-6"
    >
      <div
        className="cq-section grid gap-4"
        style={{
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
        }}
      >
        <label className="block">
          <span className="text-sm text-text-secondary">Prodotto *</span>
          <select
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              setLotId("");
            }}
            className="mt-1 w-full rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-text-primary focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
          >
            <option value="">— Seleziona —</option>
            {productOptions.map((p) => (
              <option key={p.productId} value={p.productId}>
                {p.productName} (disp. {formatNumber(p.availableBase)})
              </option>
            ))}
          </select>
          {productOptions.length === 0 && (
            <span className="mt-1 block text-xs text-text-secondary">
              Nessun prodotto con stock in questo magazzino. Puoi comunque
              rettificare carichi positivi selezionando un prodotto dopo un
              nuovo carico.
            </span>
          )}
        </label>

        <label className="block">
          <span className="text-sm text-text-secondary">Lotto (opzionale)</span>
          <select
            value={lotId}
            onChange={(e) => setLotId(e.target.value)}
            disabled={!productId || lotOptions.length === 0}
            className="mt-1 w-full rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-text-primary disabled:opacity-60 focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
          >
            <option value="">
              {!productId
                ? "— Seleziona prima un prodotto —"
                : lotOptions.length === 0
                  ? "— Nessun lotto disponibile —"
                  : "— FEFO automatico (per Δ negativi) —"}
            </option>
            {lotOptions.map((l) => (
              <option key={l.id} value={l.id}>
                {l.lotCode}
                {l.expiryDate ? ` · scad ${l.expiryDate}` : ""}
                {` · qty ${formatNumber(l.quantityBase)}`}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm text-text-secondary">
            Δ quantità (unità base) *
          </span>
          <input
            type="number"
            step="any"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="es. -5 oppure 12"
            className="mt-1 w-full rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-text-primary focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
          />
          {currentOverview && deltaValid && (
            <span className="mt-1 block text-xs text-text-secondary">
              Disponibile attuale:{" "}
              <span className="font-mono text-text-primary">
                {formatNumber(currentOverview.availableBase)}
              </span>
              {" → "}
              previsto:{" "}
              <span className="font-mono text-text-primary">
                {formatNumber(currentOverview.availableBase + deltaNum)}
              </span>
            </span>
          )}
        </label>

        <label className="block">
          <span className="text-sm text-text-secondary">Motivo *</span>
          <select
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value as ReasonCode)}
            className="mt-1 w-full rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-text-primary focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
          >
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-sm text-text-secondary">
          Note aggiuntive (opzionale)
        </span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={250}
          placeholder="Dettagli aggiuntivi, riferimento bolla, …"
          className="mt-1 w-full rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-text-primary focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
        />
      </label>

      {deltaValid && deltaNum < 0 && !lotId && (
        <div className="flex items-start gap-2 rounded-md border border-accent-amber/40 bg-accent-amber/10 p-3 text-xs text-accent-amber">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Nessun lotto selezionato: lo scarico seguirà la logica FEFO
            (lotti in scadenza più vicina per primi).
          </span>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="submit"
          disabled={pending || !productId || !deltaValid}
          className="rounded-lg bg-accent-green px-4 py-2 text-sm font-medium text-surface-base disabled:opacity-50"
        >
          {pending ? "Applico…" : "Applica rettifica"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Inventario fisico — conteggio bulk
// ---------------------------------------------------------------------------

type CountState = {
  productId: string;
  productName: string;
  system: number;
  counted: string;
};

function PhysicalCountForm({
  supplierId,
  warehouseId,
  overview,
}: {
  supplierId: string;
  warehouseId: string;
  overview: OverviewRow[];
}) {
  const [rows, setRows] = useState<CountState[]>(() =>
    [...overview]
      .sort((a, b) => a.productName.localeCompare(b.productName))
      .map((o) => ({
        productId: o.productId,
        productName: o.productName,
        system: o.availableBase,
        counted: "",
      })),
  );
  const [reasonCode, setReasonCode] = useState<ReasonCode>("conteggio fisico");
  const [note, setNote] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const changes = useMemo(() => {
    return rows
      .map((r) => {
        const parsed = r.counted.trim() === "" ? null : Number(r.counted);
        if (parsed === null || !Number.isFinite(parsed)) return null;
        const delta = parsed - r.system;
        if (delta === 0) return null;
        return { productId: r.productId, productName: r.productName, delta };
      })
      .filter((x): x is { productId: string; productName: string; delta: number } => x !== null);
  }, [rows]);

  const updateCounted = (productId: string, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.productId === productId ? { ...r, counted: value } : r)),
    );
  };

  const submit = () => {
    if (changes.length === 0) {
      toast.error("Nessuna differenza da applicare");
      return;
    }
    const trimmedNote = note.trim();
    const reason = trimmedNote ? `${reasonCode} — ${trimmedNote}` : reasonCode;

    startTransition(async () => {
      const CONCURRENCY = 10;
      let applied = 0;
      let failed = 0;
      let firstError: string | null = null;

      // Cap concurrency
      for (let i = 0; i < changes.length; i += CONCURRENCY) {
        const batch = changes.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          batch.map((c) =>
            adjustStock({
              supplierId,
              warehouseId,
              productId: c.productId,
              lotId: null,
              deltaBase: c.delta,
              reason,
            }),
          ),
        );
        for (const r of results) {
          if (r.ok) applied += 1;
          else {
            failed += 1;
            if (!firstError) firstError = r.error;
          }
        }
      }

      if (failed === 0) {
        toast.success(`Inventario applicato: ${applied} rettifiche`);
      } else if (applied === 0) {
        toast.error(`Inventario fallito: ${firstError ?? "errore"}`);
      } else {
        toast.error(
          `Applicate ${applied} su ${applied + failed}; prima errore: ${firstError ?? "errore"}`,
        );
      }

      // Reset campi contati per le righe andate a buon fine: semplificazione —
      // svuoto tutto, il server rev revalida la pagina.
      setRows((prev) => prev.map((r) => ({ ...r, counted: "" })));
      setNote("");
    });
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border-subtle bg-surface-card p-6 text-sm text-text-secondary">
        Nessun prodotto con stock per questo magazzino. Registra prima un
        carico in <span className="font-medium text-text-primary">Carichi</span>.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-border-subtle bg-surface-card p-6">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-text-secondary">
              <th className="pb-2 pr-4 font-medium">Prodotto</th>
              <th className="pb-2 pr-4 text-right font-medium">Giacenza sistema</th>
              <th className="pb-2 pr-4 text-right font-medium">Giacenza contata</th>
              <th className="pb-2 text-right font-medium">Δ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const parsed = r.counted.trim() === "" ? null : Number(r.counted);
              const delta =
                parsed !== null && Number.isFinite(parsed) ? parsed - r.system : null;
              return (
                <tr
                  key={r.productId}
                  className="border-b border-border-subtle/50 last:border-b-0"
                >
                  <td className="py-2 pr-4 text-text-primary">{r.productName}</td>
                  <td className="py-2 pr-4 text-right font-mono text-text-secondary">
                    {formatNumber(r.system)}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    <input
                      type="number"
                      step="any"
                      value={r.counted}
                      onChange={(e) => updateCounted(r.productId, e.target.value)}
                      placeholder="—"
                      className="w-28 rounded-md border border-border-subtle bg-surface-base px-2 py-1 text-right font-mono text-text-primary focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
                    />
                  </td>
                  <td
                    className={`py-2 text-right font-mono ${
                      delta === null
                        ? "text-text-secondary"
                        : delta === 0
                          ? "text-text-secondary"
                          : delta > 0
                            ? "text-accent-green"
                            : "text-accent-red"
                    }`}
                  >
                    {delta === null
                      ? "—"
                      : delta > 0
                        ? `+${formatNumber(delta)}`
                        : formatNumber(delta)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        className="cq-section grid gap-3"
        style={{
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
        }}
      >
        <label className="block">
          <span className="text-sm text-text-secondary">Motivo *</span>
          <select
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value as ReasonCode)}
            className="mt-1 w-full rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-text-primary focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
          >
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-text-secondary">Note (opzionali)</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Es. conteggio mensile, turno mattina"
            className="mt-1 w-full rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-text-primary focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
          />
        </label>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-text-secondary">
          {changes.length === 0
            ? "Nessuna differenza rilevata."
            : `${changes.length} rettifiche da applicare.`}
        </p>
        <button
          type="button"
          onClick={submit}
          disabled={pending || changes.length === 0}
          className="rounded-lg bg-accent-green px-4 py-2 text-sm font-medium text-surface-base disabled:opacity-50"
        >
          {pending ? "Applico…" : `Applica inventario (${changes.length})`}
        </button>
      </div>
    </div>
  );
}
