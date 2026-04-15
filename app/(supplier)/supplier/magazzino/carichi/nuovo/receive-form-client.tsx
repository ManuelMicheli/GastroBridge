"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { receiveLot, getCostHistoryAction } from "@/lib/supplier/stock/actions";
import { listSalesUnitsForProduct } from "@/lib/supplier/catalog/actions";

type WarehouseOption = { id: string; name: string; isPrimary: boolean };
type ProductOption = { id: string; name: string; sku: string | null };
type SalesUnit = {
  id: string;
  label: string;
  conversion_to_base: number;
  is_base: boolean;
  sort_order: number;
  is_active: boolean;
};

type Props = {
  supplierId: string;
  warehouses: WarehouseOption[];
  products: ProductOption[];
};

function todayLotCode(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `LOT-${yyyy}${mm}${dd}`;
}

function isPastDate(yyyymmdd: string): boolean {
  if (!yyyymmdd) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${yyyymmdd}T00:00:00`);
  return d.getTime() < today.getTime();
}

export function ReceiveFormClient({
  supplierId,
  warehouses,
  products,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Warehouse: preselect primary (or first).
  const primary = warehouses.find((w) => w.isPrimary) ?? warehouses[0];
  const [warehouseId, setWarehouseId] = useState<string>(primary?.id ?? "");

  // Product selection (combobox con ricerca).
  const [productQuery, setProductQuery] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [showProductList, setShowProductList] = useState<boolean>(false);

  // Sales units caricati dopo selezione prodotto.
  const [salesUnits, setSalesUnits] = useState<SalesUnit[]>([]);
  const [salesUnitsLoading, setSalesUnitsLoading] = useState<boolean>(false);
  const [salesUnitId, setSalesUnitId] = useState<string>("");

  // Campi form.
  const [quantity, setQuantity] = useState<string>("");
  const [lotCode, setLotCode] = useState<string>("");
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [costPerBase, setCostPerBase] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Cost history preview.
  const [costAvg, setCostAvg] = useState<number | null>(null);
  const [costCount, setCostCount] = useState<number>(0);

  const selectedProduct = products.find((p) => p.id === productId) ?? null;

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products.slice(0, 40);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku ?? "").toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [productQuery, products]);

  // Load sales units when product changes.
  useEffect(() => {
    if (!productId) {
      setSalesUnits([]);
      setSalesUnitId("");
      return;
    }
    let cancelled = false;
    setSalesUnitsLoading(true);
    listSalesUnitsForProduct(productId)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          toast.error(res.error);
          setSalesUnits([]);
          setSalesUnitId("");
          return;
        }
        const active = res.data.filter((u) => u.is_active);
        setSalesUnits(
          active.map((u) => ({
            id: u.id,
            label: u.label,
            conversion_to_base: Number(u.conversion_to_base),
            is_base: u.is_base,
            sort_order: u.sort_order,
            is_active: u.is_active,
          })),
        );
        // Default: unità base.
        const base = active.find((u) => u.is_base) ?? active[0];
        setSalesUnitId(base?.id ?? "");
      })
      .finally(() => {
        if (!cancelled) setSalesUnitsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  // Load cost history when product + warehouse set.
  useEffect(() => {
    if (!productId || !warehouseId) {
      setCostAvg(null);
      setCostCount(0);
      return;
    }
    let cancelled = false;
    getCostHistoryAction(supplierId, productId, warehouseId).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setCostAvg(null);
        setCostCount(0);
        return;
      }
      setCostAvg(res.data.count > 0 ? res.data.avg : null);
      setCostCount(res.data.count);
    });
    return () => {
      cancelled = true;
    };
  }, [supplierId, productId, warehouseId]);

  const selectedSalesUnit = salesUnits.find((u) => u.id === salesUnitId) ?? null;
  const quantityNum = Number(quantity);
  const quantityBasePreview =
    selectedSalesUnit && Number.isFinite(quantityNum) && quantityNum > 0
      ? quantityNum * selectedSalesUnit.conversion_to_base
      : null;

  const costNum = costPerBase === "" ? null : Number(costPerBase);
  const costDeltaPct =
    costAvg !== null && costAvg > 0 && costNum !== null && costNum > 0
      ? ((costNum - costAvg) / costAvg) * 100
      : null;
  const costAnomaly = costDeltaPct !== null && Math.abs(costDeltaPct) > 15;
  const expiryPast = isPastDate(expiryDate);

  // Inline validation.
  const errors: Record<string, string> = {};
  if (!warehouseId) errors.warehouseId = "Seleziona un magazzino";
  if (!productId) errors.productId = "Seleziona un prodotto";
  if (!salesUnitId) errors.salesUnitId = "Seleziona l'unità di vendita";
  if (quantity === "" || !Number.isFinite(quantityNum)) {
    errors.quantity = "Quantità obbligatoria";
  } else if (quantityNum <= 0) {
    errors.quantity = "Quantità deve essere positiva";
  }
  const trimmedLot = lotCode.trim();
  if (trimmedLot.length === 0) {
    errors.lotCode = "Lot code obbligatorio";
  } else if (trimmedLot.length > 80) {
    errors.lotCode = "Massimo 80 caratteri";
  }
  if (costPerBase !== "" && (!Number.isFinite(costNum) || (costNum ?? 0) < 0)) {
    errors.costPerBase = "Costo deve essere positivo";
  }
  if (notes.length > 500) errors.notes = "Massimo 500 caratteri";
  if (expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
    errors.expiryDate = "Formato data non valido";
  }
  const hasErrors = Object.keys(errors).length > 0;

  const submit = () => {
    if (hasErrors) {
      toast.error(Object.values(errors)[0]);
      return;
    }
    const effectiveLot = trimmedLot || todayLotCode();
    startTransition(async () => {
      const res = await receiveLot({
        supplierId,
        warehouseId,
        productId,
        salesUnitId,
        quantitySalesUnit: quantityNum,
        lotCode: effectiveLot,
        expiryDate: expiryDate || null,
        costPerBase: costNum,
        notes: notes.trim() ? notes.trim() : undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data.warning === "costo_anomalo") {
        toast.warning(
          "Carico registrato — costo anomalo rispetto alla media storica.",
        );
      } else {
        toast.success("Carico registrato");
      }
      router.push("/supplier/magazzino/carichi");
      router.refresh();
    });
  };

  // Ctrl/Cmd+Enter shortcut.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (!pending && !hasErrors) submit();
    }
  };

  return (
    <div
      className="rounded-xl border border-border-subtle bg-surface-card p-6 space-y-5"
      onKeyDown={onKeyDown}
    >
      {/* Magazzino */}
      <div>
        <label className="block">
          <span className="text-sm text-text-secondary">Magazzino *</span>
          {warehouses.length === 1 && warehouses[0] ? (
            <div className="mt-1 rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary">
              {warehouses[0].name}
              {warehouses[0].isPrimary && (
                <span className="ml-2 text-xs text-accent-green">(primario)</span>
              )}
            </div>
          ) : (
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.isPrimary ? " (primario)" : ""}
                </option>
              ))}
            </select>
          )}
        </label>
        {errors.warehouseId && (
          <p className="mt-1 text-xs text-red-500">{errors.warehouseId}</p>
        )}
      </div>

      {/* Prodotto — combobox */}
      <div>
        <label className="block relative">
          <span className="text-sm text-text-secondary">Prodotto *</span>
          <input
            type="text"
            value={
              selectedProduct && !showProductList
                ? `${selectedProduct.name}${
                    selectedProduct.sku ? ` (${selectedProduct.sku})` : ""
                  }`
                : productQuery
            }
            onChange={(e) => {
              setProductQuery(e.target.value);
              setShowProductList(true);
              if (productId) setProductId("");
            }}
            onFocus={() => setShowProductList(true)}
            onBlur={() => {
              // delay to allow click.
              setTimeout(() => setShowProductList(false), 150);
            }}
            placeholder="Cerca per nome o SKU…"
            className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
          />
          {showProductList && filteredProducts.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border-subtle bg-surface-card shadow-lg">
              {filteredProducts.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-hover"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setProductId(p.id);
                      setProductQuery("");
                      setShowProductList(false);
                    }}
                  >
                    <span>{p.name}</span>
                    {p.sku && (
                      <span className="text-xs text-text-secondary">{p.sku}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {showProductList &&
            productQuery.trim().length > 0 &&
            filteredProducts.length === 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-border-subtle bg-surface-card px-3 py-2 text-sm text-text-secondary">
                Nessun prodotto trovato.
              </div>
            )}
        </label>
        {errors.productId && (
          <p className="mt-1 text-xs text-red-500">{errors.productId}</p>
        )}
      </div>

      {/* Sales unit + quantità */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block">
            <span className="text-sm text-text-secondary">Unità di vendita *</span>
            <select
              value={salesUnitId}
              onChange={(e) => setSalesUnitId(e.target.value)}
              disabled={!productId || salesUnitsLoading || salesUnits.length === 0}
              className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary disabled:opacity-50"
            >
              {!productId && <option value="">Seleziona prima un prodotto</option>}
              {productId && salesUnitsLoading && (
                <option value="">Caricamento…</option>
              )}
              {productId && !salesUnitsLoading && salesUnits.length === 0 && (
                <option value="">Nessuna unità disponibile</option>
              )}
              {salesUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                  {u.is_base ? " (base)" : ` · ×${u.conversion_to_base}`}
                </option>
              ))}
            </select>
          </label>
          {errors.salesUnitId && (
            <p className="mt-1 text-xs text-red-500">{errors.salesUnitId}</p>
          )}
        </div>

        <div>
          <label className="block">
            <span className="text-sm text-text-secondary">
              Quantità (unità di vendita) *
            </span>
            <input
              type="number"
              min="0"
              step="0.001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
              placeholder="Es. 10"
            />
          </label>
          {quantityBasePreview !== null && selectedSalesUnit && (
            <p className="mt-1 text-xs text-text-secondary">
              = {quantityBasePreview.toLocaleString("it-IT", {
                maximumFractionDigits: 3,
              })}{" "}
              unità base
            </p>
          )}
          {errors.quantity && (
            <p className="mt-1 text-xs text-red-500">{errors.quantity}</p>
          )}
        </div>
      </div>

      {/* Lot code + scadenza */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block">
            <span className="text-sm text-text-secondary">Lot code *</span>
            <input
              type="text"
              value={lotCode}
              onChange={(e) => setLotCode(e.target.value)}
              onBlur={() => {
                if (!lotCode.trim()) setLotCode(todayLotCode());
              }}
              placeholder={todayLotCode()}
              className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary font-mono"
            />
          </label>
          <p className="mt-1 text-xs text-text-secondary">
            Auto-suggerimento: <span className="font-mono">{todayLotCode()}</span>
          </p>
          {errors.lotCode && (
            <p className="mt-1 text-xs text-red-500">{errors.lotCode}</p>
          )}
        </div>

        <div>
          <label className="block">
            <span className="text-sm text-text-secondary">Data scadenza</span>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
            />
          </label>
          {expiryPast && (
            <p className="mt-1 text-xs text-amber-500">
              Attenzione: data scadenza già passata.
            </p>
          )}
          {errors.expiryDate && (
            <p className="mt-1 text-xs text-red-500">{errors.expiryDate}</p>
          )}
        </div>
      </div>

      {/* Costo per unità base */}
      <div>
        <label className="block">
          <span className="text-sm text-text-secondary">
            Costo per unità base (€)
          </span>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={costPerBase}
            onChange={(e) => setCostPerBase(e.target.value)}
            className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
            placeholder="Opzionale"
          />
        </label>
        {costCount > 0 && costAvg !== null && (
          <p className="mt-1 text-xs text-text-secondary">
            Media storica: {costAvg.toLocaleString("it-IT", {
              style: "currency",
              currency: "EUR",
              maximumFractionDigits: 4,
            })}{" "}
            su {costCount} carichi recenti
            {costDeltaPct !== null && (
              <>
                {" · "}
                <span
                  className={
                    costAnomaly ? "text-amber-500" : "text-text-secondary"
                  }
                >
                  Δ {costDeltaPct >= 0 ? "+" : ""}
                  {costDeltaPct.toFixed(1)}%
                </span>
              </>
            )}
          </p>
        )}
        {costAnomaly && (
          <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
            Costo anomalo rispetto alla media storica (
            {costAvg?.toLocaleString("it-IT", {
              style: "currency",
              currency: "EUR",
              maximumFractionDigits: 4,
            })}
            /base). Verifica prima di confermare.
          </div>
        )}
        {errors.costPerBase && (
          <p className="mt-1 text-xs text-red-500">{errors.costPerBase}</p>
        )}
      </div>

      {/* Note */}
      <div>
        <label className="block">
          <span className="text-sm text-text-secondary">Note</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={500}
            className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
            placeholder="Note interne sul carico"
          />
        </label>
        {errors.notes && (
          <p className="mt-1 text-xs text-red-500">{errors.notes}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Link
          href="/supplier/magazzino/carichi"
          className="px-4 py-2 rounded-lg text-text-secondary hover:bg-surface-hover"
        >
          Annulla
        </Link>
        <button
          type="button"
          onClick={submit}
          disabled={pending || hasErrors}
          className="px-4 py-2 rounded-lg bg-accent-green text-surface-base font-medium disabled:opacity-50"
          title="Ctrl/Cmd+Enter per invio rapido"
        >
          {pending ? "Registro…" : "Registra carico"}
        </button>
      </div>
    </div>
  );
}
