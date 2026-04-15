"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search as SearchIcon, BookMarked, Plus, Trash2, ShoppingBasket, Upload, UploadCloud, Check, ArrowLeft, Download } from "lucide-react";
import { parseCsv, parseXlsx, suggestMapping, type ParsedSheet } from "@/lib/catalogs/parse-file";
import { normalizeName, normalizeUnit } from "@/lib/catalogs/normalize";

export type SupplierLite = { id: string; supplier_name: string };
export type CatalogItemLite = {
  id: string;
  catalog_id: string;
  product_name: string;
  product_name_normalized: string;
  unit: string;
  price: number;
  notes: string | null;
};

type Group = {
  key: string;
  productName: string;
  unit: string;
  offers: { supplier: SupplierLite; price: number; itemId: string }[];
};

type Props = {
  suppliers: SupplierLite[];
  items: CatalogItemLite[];
};

export function SearchPageClient({ suppliers, items }: Props) {
  const [query, setQuery] = useState("");

  const supplierById = useMemo(() => {
    const m = new Map<string, SupplierLite>();
    for (const s of suppliers) m.set(s.id, s);
    return m;
  }, [suppliers]);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const it of items) {
      const supplier = supplierById.get(it.catalog_id);
      if (!supplier) continue;
      const key = `${it.product_name_normalized}::${it.unit}`;
      let g = map.get(key);
      if (!g) {
        g = { key, productName: it.product_name, unit: it.unit, offers: [] };
        map.set(key, g);
      }
      g.offers.push({ supplier, price: it.price, itemId: it.id });
    }
    for (const g of map.values()) g.offers.sort((a, b) => a.price - b.price);
    return Array.from(map.values()).sort((a, b) =>
      a.productName.localeCompare(b.productName, "it"),
    );
  }, [items, supplierById]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.productName.toLowerCase().includes(q));
  }, [groups, query]);

  if (suppliers.length === 0) {
    return (
      <div className="p-6 max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold text-text-primary">Cerca prodotti</h1>
        <div className="rounded-xl border border-dashed border-border-subtle p-12 text-center">
          <BookMarked className="mx-auto h-8 w-8 text-text-tertiary" />
          <h2 className="mt-3 text-lg font-medium text-text-primary">Nessun catalogo ancora</h2>
          <p className="mt-1 text-sm text-text-secondary">
            La ricerca confronta i prodotti tra i tuoi cataloghi fornitore. Crea il primo catalogo per iniziare.
          </p>
          <Link
            href="/cataloghi"
            className="mt-4 inline-flex px-4 py-2 rounded-lg bg-accent-green text-surface-base font-medium"
          >
            Vai ai cataloghi
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-text-primary">Cerca prodotti</h1>
        <p className="text-sm text-text-secondary">
          Trova il prezzo più basso tra i tuoi {suppliers.length} cataloghi fornitore.
        </p>
      </header>

      <TypicalOrderSection groups={groups} />

      <div className="border-t border-border-subtle pt-6 space-y-4">
        <h2 className="text-xl font-semibold text-text-primary flex items-center gap-2">
          <SearchIcon className="h-5 w-5 text-accent-green" /> Ricerca singolo prodotto
        </h2>
        <div className="relative max-w-xl">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <input
            type="search"
            placeholder="Es. farina, olio, pomodoro..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg bg-surface-base border border-border-subtle pl-9 pr-3 py-2.5 text-text-primary"
          />
        </div>
      </div>

      <p className="text-xs text-text-tertiary">
        {filtered.length} {filtered.length === 1 ? "prodotto" : "prodotti"}
        {query && ` per "${query}"`}
      </p>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-text-tertiary">
          {query
            ? <>Nessun prodotto contiene &quot;{query}&quot; nei tuoi cataloghi.</>
            : "Inizia a digitare per cercare."}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((g) => {
            const cheapest = g.offers[0];
            const cheapestPrice = cheapest?.price;
            return (
              <li key={g.key} className="rounded-xl bg-surface-card border border-border-subtle p-4">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <h3 className="text-base font-semibold text-text-primary">
                    {g.productName} <span className="text-xs text-text-tertiary font-normal">/ {g.unit}</span>
                  </h3>
                  {cheapest && (
                    <span className="text-sm text-text-secondary">
                      Migliore: <span className="text-accent-green font-medium">€ {cheapestPrice!.toFixed(2)}</span>
                      {" "}da {cheapest.supplier.supplier_name}
                    </span>
                  )}
                </div>
                <ul className="mt-3 divide-y divide-border-subtle">
                  {g.offers.map((o) => {
                    const isBest = o.price === cheapestPrice;
                    return (
                      <li key={o.itemId} className="flex items-center justify-between py-1.5 text-sm">
                        <Link
                          href={`/cataloghi/${o.supplier.id}`}
                          className={`hover:underline ${isBest ? "text-accent-green" : "text-text-secondary"}`}
                        >
                          {o.supplier.supplier_name}
                        </Link>
                        <span
                          className={`tabular-nums ${isBest ? "text-accent-green font-medium" : "text-text-primary"}`}
                        >
                          € {o.price.toFixed(2)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// "Il tuo ordine tipico" — basket of recurring items optimized across catalogs.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "gb.typical-order";

type OrderLine = { key: string; productName: string; unit: string; qty: number };

function TypicalOrderSection({ groups }: { groups: Group[] }) {
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [pickKey, setPickKey] = useState("");
  const [qty, setQty] = useState("1");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as OrderLine[];
        if (Array.isArray(parsed)) setLines(parsed);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines, hydrated]);

  const groupByKey = useMemo(() => {
    const m = new Map<string, Group>();
    for (const g of groups) m.set(g.key, g);
    return m;
  }, [groups]);

  const addLine = () => {
    const g = groupByKey.get(pickKey);
    if (!g) return;
    const q = Number(qty.replace(",", "."));
    if (!Number.isFinite(q) || q <= 0) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.key === g.key);
      if (existing) {
        return prev.map((l) => (l.key === g.key ? { ...l, qty: l.qty + q } : l));
      }
      return [...prev, { key: g.key, productName: g.productName, unit: g.unit, qty: q }];
    });
    setPickKey("");
    setQty("1");
  };

  const removeLine = (key: string) =>
    setLines((prev) => prev.filter((l) => l.key !== key));

  const updateQty = (key: string, raw: string) => {
    const q = Number(raw.replace(",", "."));
    if (!Number.isFinite(q) || q <= 0) return;
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, qty: q } : l)));
  };

  // Compute best-price + per-supplier totals
  type Computed = {
    line: OrderLine;
    available: boolean;
    bestPrice: number | null;
    bestSupplier: SupplierLite | null;
    bestLineTotal: number;
  };
  const computed: Computed[] = lines.map((line) => {
    const g = groupByKey.get(line.key);
    if (!g || g.offers.length === 0) {
      return { line, available: false, bestPrice: null, bestSupplier: null, bestLineTotal: 0 };
    }
    const cheapest = g.offers[0]!; // offers already sorted ASC
    return {
      line,
      available: true,
      bestPrice: cheapest.price,
      bestSupplier: cheapest.supplier,
      bestLineTotal: cheapest.price * line.qty,
    };
  });

  const basketOptimal = computed.reduce((s, c) => s + c.bestLineTotal, 0);

  // Per-supplier total: would the user buy everything from one supplier?
  const supplierIds = useMemo(() => {
    const set = new Set<string>();
    for (const g of groups) for (const o of g.offers) set.add(o.supplier.id);
    return Array.from(set);
  }, [groups]);

  const perSupplier = supplierIds
    .map((sid) => {
      const g0 = groups.find((g) => g.offers.some((o) => o.supplier.id === sid));
      const supplierName = g0?.offers.find((o) => o.supplier.id === sid)?.supplier.supplier_name ?? "";
      let total = 0;
      let coveredItems = 0;
      for (const line of lines) {
        const g = groupByKey.get(line.key);
        const offer = g?.offers.find((o) => o.supplier.id === sid);
        if (offer) {
          total += offer.price * line.qty;
          coveredItems += 1;
        }
      }
      return { id: sid, name: supplierName, total, coveredItems };
    })
    .filter((s) => s.coveredItems > 0)
    .sort((a, b) => {
      // Prefer suppliers that cover all items, then by price
      if (a.coveredItems !== b.coveredItems) return b.coveredItems - a.coveredItems;
      return a.total - b.total;
    });

  const [importOpen, setImportOpen] = useState(false);

  const onImported = (incoming: OrderLine[], mode: "append" | "replace") => {
    setLines((prev) => {
      const base = mode === "replace" ? [] : prev;
      const merged = [...base];
      for (const line of incoming) {
        const existing = merged.find((l) => l.key === line.key);
        if (existing) existing.qty += line.qty;
        else merged.push(line);
      }
      return merged;
    });
  };

  return (
    <section>
      <header className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-2">
          <ShoppingBasket className="h-5 w-5 text-accent-green" />
          <h2 className="text-xl font-semibold text-text-primary">Il tuo ordine tipico</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-subtle text-text-primary hover:bg-surface-hover text-sm"
          >
            <Upload className="h-4 w-4" /> Importa da file
          </button>
          <Link
            href="/cerca/ordine"
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium ${
              lines.length === 0
                ? "bg-surface-base text-text-tertiary opacity-50 pointer-events-none"
                : "bg-accent-green text-surface-base"
            }`}
          >
            <ShoppingBasket className="h-4 w-4" /> Carrello ottimale
          </Link>
        </div>
      </header>
      <p className="text-sm text-text-secondary mb-4">
        Aggiungi i prodotti che acquisti regolarmente con la quantità: vedi subito il prezzo migliore per riga e il totale del basket ottimale. Puoi anche importarli da un file Excel/CSV.
      </p>

      {/* Add row */}
      <div className="flex flex-wrap items-end gap-2 mb-4">
        <label className="block flex-1 min-w-[200px]">
          <span className="text-xs text-text-tertiary">Prodotto</span>
          <select
            value={pickKey}
            onChange={(e) => setPickKey(e.target.value)}
            className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
          >
            <option value="">— scegli un prodotto —</option>
            {groups.map((g) => (
              <option key={g.key} value={g.key}>
                {g.productName} ({g.unit})
              </option>
            ))}
          </select>
        </label>
        <label className="block w-24">
          <span className="text-xs text-text-tertiary">Quantità</span>
          <input
            type="number" min={0} step="0.1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
          />
        </label>
        <button
          onClick={addLine}
          disabled={!pickKey}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-green text-surface-base font-medium disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Aggiungi
        </button>
      </div>

      <TypicalOrderImportWizard
        open={importOpen}
        onClose={() => setImportOpen(false)}
        groups={groups}
        onImported={onImported}
      />

      {lines.length === 0 ? (
        <p className="text-sm text-text-tertiary py-6 text-center border border-dashed border-border-subtle rounded-lg">
          Nessun prodotto nell&apos;ordine tipico. Aggiungine uno qui sopra.
        </p>
      ) : (
        <>
          <div className="rounded-xl border border-border-subtle overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-card text-text-tertiary">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Prodotto</th>
                  <th className="text-right px-3 py-2 font-medium">Q.tà</th>
                  <th className="text-left px-3 py-2 font-medium">Unità</th>
                  <th className="text-right px-3 py-2 font-medium">Miglior prezzo</th>
                  <th className="text-left px-3 py-2 font-medium">Fornitore</th>
                  <th className="text-right px-3 py-2 font-medium">Totale riga</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {computed.map(({ line, available, bestPrice, bestSupplier, bestLineTotal }) => (
                  <tr key={line.key} className="border-t border-border-subtle">
                    <td className="px-3 py-2 text-text-primary">{line.productName}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number" min={0} step="0.1"
                        value={line.qty}
                        onChange={(e) => updateQty(line.key, e.target.value)}
                        className="w-20 rounded bg-surface-base border border-border-subtle px-2 py-1 text-right text-text-primary tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-2 text-text-secondary">{line.unit}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {available
                        ? <span className="text-accent-green font-medium">€ {bestPrice!.toFixed(2)}</span>
                        : <span className="text-text-tertiary">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {available && bestSupplier
                        ? <Link href={`/cataloghi/${bestSupplier.id}`} className="text-accent-green hover:underline">{bestSupplier.supplier_name}</Link>
                        : <span className="text-text-tertiary text-xs">non disponibile</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-text-primary">
                      {available ? <>€ {bestLineTotal.toFixed(2)}</> : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => removeLine(line.key)}
                        className="p-1.5 rounded hover:bg-red-500/10 text-red-400" title="Rimuovi"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-surface-card">
                <tr className="border-t border-border-subtle">
                  <td colSpan={5} className="px-3 py-2 font-medium text-text-primary text-right">
                    Basket ottimale (split su più fornitori)
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-accent-green font-semibold">
                    € {basketOptimal.toFixed(2)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Single-supplier comparison */}
          {perSupplier.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-text-primary mb-2">
                Se comprassi tutto da un solo fornitore:
              </h3>
              <ul className="rounded-xl border border-border-subtle divide-y divide-border-subtle">
                {perSupplier.map((s) => {
                  const isFull = s.coveredItems === lines.length;
                  return (
                    <li key={s.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-text-secondary">
                        <Link href={`/cataloghi/${s.id}`} className="hover:underline text-text-primary">{s.name}</Link>
                        {!isFull && (
                          <span className="ml-2 text-xs text-text-tertiary">
                            (copre {s.coveredItems}/{lines.length})
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums text-text-primary">
                        € {s.total.toFixed(2)}
                        {isFull && s.total > basketOptimal && (
                          <span className="ml-2 text-xs text-text-tertiary">
                            (+€ {(s.total - basketOptimal).toFixed(2)} vs split)
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Import wizard for typical order — accepts CSV/XLSX with name+unit+qty.
// ---------------------------------------------------------------------------

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 5000;

type WizardStep = "upload" | "map" | "preview";
type Mapping = { name: string; unit: string; qty: string };
type ValidatedRow =
  | { ok: true; matchedKey: string | null; productName: string; unit: string; qty: number }
  | { ok: false; reason: string; raw: { name: string; unit: string; qty: string } };

function TypicalOrderImportWizard({
  open,
  onClose,
  groups,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  groups: Group[];
  onImported: (lines: OrderLine[], mode: "append" | "replace") => void;
}) {
  const [step, setStep] = useState<WizardStep>("upload");
  const [hasHeader, setHasHeader] = useState(true);
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<Mapping>({ name: "", unit: "", qty: "" });
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep("upload");
    setSheet(null);
    setMapping({ name: "", unit: "", qty: "" });
    setError(null);
  };
  const closeAll = () => { reset(); onClose(); };

  const groupByNormKey = useMemo(() => {
    const m = new Map<string, Group>();
    for (const g of groups) m.set(`${normalizeName(g.productName)}::${normalizeUnit(g.unit)}`, g);
    return m;
  }, [groups]);

  const validated: ValidatedRow[] = useMemo(() => {
    if (!sheet) return [];
    return sheet.rows.map((r) => {
      const name = (r[mapping.name] ?? "").trim();
      const unit = (r[mapping.unit] ?? "").trim();
      const qtyRaw = (r[mapping.qty] ?? "").trim();

      if (!name) return { ok: false, reason: "Nome vuoto", raw: { name, unit, qty: qtyRaw } };
      if (!unit) return { ok: false, reason: "Unità vuota", raw: { name, unit, qty: qtyRaw } };

      const qtyNum = Number(qtyRaw.replace(",", "."));
      if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
        return { ok: false, reason: "Quantità non valida", raw: { name, unit, qty: qtyRaw } };
      }

      const key = `${normalizeName(name)}::${normalizeUnit(unit)}`;
      const matched = groupByNormKey.get(key);
      return {
        ok: true,
        matchedKey: matched ? matched.key : null,
        productName: matched?.productName ?? name,
        unit:        matched?.unit ?? unit,
        qty:         qtyNum,
      };
    });
  }, [sheet, mapping, groupByNormKey]);

  if (!open) return null;

  const handleFile = async (file: File) => {
    setError(null);
    if (file.size > MAX_BYTES) { setError("File troppo grande (max 2MB)"); return; }
    try {
      const ext = file.name.toLowerCase().split(".").pop() ?? "";
      let parsed: ParsedSheet;
      if (ext === "csv") parsed = await parseCsv(file, hasHeader);
      else if (ext === "xlsx" || ext === "xls") parsed = await parseXlsx(file, hasHeader);
      else { setError("Formato non supportato"); return; }

      if (parsed.rows.length === 0) { setError("Nessuna riga di dati nel file"); return; }
      if (parsed.rows.length > MAX_ROWS) { setError(`Troppe righe (max ${MAX_ROWS})`); return; }

      setSheet(parsed);
      const suggested = suggestMapping(parsed.headers);
      const qtyHeader = parsed.headers.find((h) => /quant|q.tà|qta|qty/i.test(h));
      setMapping({
        name: suggested.name ?? parsed.headers[0] ?? "",
        unit: suggested.unit ?? parsed.headers[1] ?? "",
        qty:  qtyHeader ?? parsed.headers[2] ?? "",
      });
      setStep("map");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore lettura file");
    }
  };

  const validRows = validated.filter((v): v is Extract<ValidatedRow, { ok: true }> => v.ok);
  const invalidCount = validated.length - validRows.length;
  const matchedCount = validRows.filter((v) => v.matchedKey !== null).length;
  const unmatchedCount = validRows.length - matchedCount;

  const confirmImport = () => {
    if (validRows.length === 0) return;
    const lines: OrderLine[] = validRows.map((v) => ({
      key: v.matchedKey ?? `${normalizeName(v.productName)}::${normalizeUnit(v.unit)}`,
      productName: v.productName,
      unit: v.unit,
      qty: v.qty,
    }));
    onImported(lines, mode);
    closeAll();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeAll}>
      <div
        className="w-full max-w-3xl rounded-xl bg-surface-card border border-border-subtle p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Importa ordine tipico</h2>
          <div className="text-xs text-text-tertiary">
            {step === "upload" ? "1/3 Upload" : step === "map" ? "2/3 Mappa colonne" : "3/3 Anteprima"}
          </div>
        </header>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {step === "upload" && (
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
              Il file ha un&apos;intestazione sulla prima riga
            </label>
            <label className="block rounded-xl border-2 border-dashed border-border-subtle p-12 text-center cursor-pointer hover:border-accent-green/40">
              <UploadCloud className="mx-auto h-8 w-8 text-text-tertiary" />
              <p className="mt-3 text-text-primary">Clicca per scegliere un file</p>
              <p className="mt-1 text-xs text-text-tertiary">CSV, XLS, XLSX · max 2MB · max 5000 righe</p>
              <p className="mt-1 text-xs text-text-tertiary">Colonne attese: nome, unità, quantità</p>
              <input
                type="file" accept=".csv,.xls,.xlsx" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </label>
            <a
              href="data:text/csv;charset=utf-8,nome;unita;quantita%0AFarina%2000;kg;10%0AOlio%20EVO;L;5%0APomodoro%20pelato;kg;8"
              download="template-ordine-tipico.csv"
              className="inline-flex items-center gap-1 text-sm text-accent-green hover:underline"
            >
              <Download className="h-4 w-4" /> Scarica template CSV
            </a>
          </div>
        )}

        {step === "map" && sheet && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(["name", "unit", "qty"] as const).map((field) => (
                <label key={field} className="block">
                  <span className="text-sm text-text-secondary">
                    {field === "name" ? "Nome prodotto" : field === "unit" ? "Unità" : "Quantità"} *
                  </span>
                  <select
                    value={mapping[field]}
                    onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}
                    className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
                  >
                    <option value="">—</option>
                    {sheet.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div className="rounded-lg border border-border-subtle overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-base text-text-tertiary">
                  <tr>{sheet.headers.map((h) => <th key={h} className="text-left px-2 py-1 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {sheet.rows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-t border-border-subtle">
                      {sheet.headers.map((h) => <td key={h} className="px-2 py-1 text-text-secondary">{r[h]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep("upload")} className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary">
                <ArrowLeft className="h-4 w-4" /> Indietro
              </button>
              <button
                onClick={() => setStep("preview")}
                disabled={!mapping.name || !mapping.unit || !mapping.qty}
                className="px-4 py-2 rounded-lg bg-accent-green text-surface-base font-medium disabled:opacity-50"
              >
                Continua
              </button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm flex-wrap">
              <span className="inline-flex items-center gap-1 text-accent-green">
                <Check className="h-4 w-4" /> {matchedCount} trovate nei cataloghi
              </span>
              {unmatchedCount > 0 && (
                <span className="text-yellow-400">{unmatchedCount} non disponibili nei cataloghi</span>
              )}
              {invalidCount > 0 && <span className="text-red-400">{invalidCount} scartate</span>}
            </div>

            <div className="rounded-lg border border-border-subtle max-h-64 overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-base text-text-tertiary sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1 font-medium">Stato</th>
                    <th className="text-left px-2 py-1 font-medium">Nome</th>
                    <th className="text-left px-2 py-1 font-medium">Unità</th>
                    <th className="text-right px-2 py-1 font-medium">Q.tà</th>
                    <th className="text-left px-2 py-1 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {validated.map((v, i) => (
                    <tr key={i} className="border-t border-border-subtle">
                      {v.ok ? (
                        <>
                          <td className="px-2 py-1">
                            {v.matchedKey
                              ? <span className="text-accent-green">OK</span>
                              : <span className="text-yellow-400">Non in catalogo</span>}
                          </td>
                          <td className="px-2 py-1 text-text-primary">{v.productName}</td>
                          <td className="px-2 py-1 text-text-secondary">{v.unit}</td>
                          <td className="px-2 py-1 text-right text-text-primary tabular-nums">{v.qty}</td>
                          <td className="px-2 py-1 text-text-tertiary text-xs">
                            {v.matchedKey ? "Trovato nei tuoi cataloghi" : "Sarà aggiunto come 'non disponibile'"}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-2 py-1 text-red-400">✗</td>
                          <td className="px-2 py-1 text-text-tertiary">{v.raw.name || "—"}</td>
                          <td className="px-2 py-1 text-text-tertiary">{v.raw.unit || "—"}</td>
                          <td className="px-2 py-1 text-right text-text-tertiary tabular-nums">{v.raw.qty || "—"}</td>
                          <td className="px-2 py-1 text-red-400 text-xs">{v.reason}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <fieldset className="flex gap-4 text-sm">
              <label className="inline-flex items-center gap-1">
                <input type="radio" checked={mode === "append"} onChange={() => setMode("append")} /> Aggiungi all&apos;ordine
              </label>
              <label className="inline-flex items-center gap-1">
                <input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} /> Sostituisci ordine
              </label>
            </fieldset>

            <div className="flex justify-between">
              <button onClick={() => setStep("map")} className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary">
                <ArrowLeft className="h-4 w-4" /> Indietro
              </button>
              <button
                onClick={confirmImport}
                disabled={validRows.length === 0}
                className="px-4 py-2 rounded-lg bg-accent-green text-surface-base font-medium disabled:opacity-50"
              >
                Conferma ({validRows.length} righe)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
