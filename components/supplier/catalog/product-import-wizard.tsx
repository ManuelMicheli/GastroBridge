"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { UploadCloud, Check, ArrowLeft, Download, Wand2, Pencil } from "lucide-react";
import { parseCsv, parseXlsx, suggestMapping, extractUnitFromText, type ParsedSheet } from "@/lib/catalogs/parse-file";
import { normalizePrice } from "@/lib/catalogs/normalize";
import { importSupplierProducts, type ProductImportRow } from "@/lib/products/import-actions";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 5000;

const UNIT_ENUM = ["kg", "g", "lt", "ml", "pz", "cartone", "bottiglia", "latta", "confezione"] as const;
type UnitEnum = (typeof UNIT_ENUM)[number];

const UNIT_SYNONYMS: Record<string, UnitEnum> = {
  kg: "kg", "kg.": "kg", chilogrammo: "kg", chilogrammi: "kg", chilo: "kg", chili: "kg", kilo: "kg",
  g: "g", gr: "g", grammo: "g", grammi: "g", "g.": "g", "gr.": "g",
  l: "lt", "l.": "lt", lt: "lt", litro: "lt", litri: "lt", "lt.": "lt",
  ml: "ml", millilitro: "ml", millilitri: "ml",
  pz: "pz", "pz.": "pz", pezzo: "pz", pezzi: "pz", cad: "pz", cadauno: "pz", n: "pz", nr: "pz",
  cartone: "cartone", cartoni: "cartone", ct: "cartone",
  bottiglia: "bottiglia", bottiglie: "bottiglia", btg: "bottiglia",
  latta: "latta", latte: "latta",
  confezione: "confezione", confezioni: "confezione", cf: "confezione", conf: "confezione",
};

function normalizeUnitToEnum(raw: string): UnitEnum | null {
  const cleaned = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (!cleaned) return null;
  if ((UNIT_ENUM as readonly string[]).includes(cleaned)) return cleaned as UnitEnum;
  return UNIT_SYNONYMS[cleaned] ?? null;
}

type Mapping = {
  name: string;
  unit: string;
  price: string;
  brand: string;
  description: string;
  origin: string;
  min_quantity: string;
};

type Step = "upload" | "preview";
type ValidatedRow =
  | { ok: true; data: ProductImportRow }
  | { ok: false; reason: string; raw: Record<string, string> };

export type CategoryOption = { id: string; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  categories: CategoryOption[];
  onImported?: () => void;
};

const EMPTY_MAPPING: Mapping = {
  name: "", unit: "", price: "", brand: "", description: "", origin: "", min_quantity: "",
};

export function ProductImportWizard({ open, onClose, categories, onImported }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [hasHeader, setHasHeader] = useState(true);
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<Mapping>(EMPTY_MAPPING);
  const [autoDetected, setAutoDetected] = useState(false);
  const [showMappingEditor, setShowMappingEditor] = useState(false);
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id ?? "");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setStep("upload");
    setSheet(null);
    setMapping(EMPTY_MAPPING);
    setAutoDetected(false);
    setShowMappingEditor(false);
  };
  const closeAll = () => { reset(); onClose(); };

  const handleFile = async (file: File) => {
    if (file.size > MAX_BYTES) { toast.error("File troppo grande (max 2MB)"); return; }
    try {
      const ext = file.name.toLowerCase().split(".").pop() ?? "";
      let parsed: ParsedSheet;
      if (ext === "csv") parsed = await parseCsv(file, hasHeader);
      else if (ext === "xlsx" || ext === "xls") parsed = await parseXlsx(file, hasHeader);
      else { toast.error("Formato non supportato"); return; }

      if (parsed.rows.length === 0) { toast.error("Nessuna riga di dati nel file"); return; }
      if (parsed.rows.length > MAX_ROWS) { toast.error(`Troppe righe (max ${MAX_ROWS})`); return; }

      const suggested = suggestMapping(parsed.headers, parsed.rows);
      const lc = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const findByKeywords = (keys: string[], skip: Set<string>): string => {
        const found = parsed.headers.find((h) => !skip.has(h) && keys.some((k) => lc(h).includes(lc(k))));
        return found ?? "";
      };
      const reserved = new Set<string>([suggested.name, suggested.unit, suggested.price].filter(Boolean) as string[]);
      const brand = findByKeywords(["brand", "marca", "produttore"], reserved);
      if (brand) reserved.add(brand);
      const origin = findByKeywords(["origine", "provenienza", "paese"], reserved);
      if (origin) reserved.add(origin);
      const description = findByKeywords(["descrizione", "descr", "note", "ingredient"], reserved);
      if (description) reserved.add(description);
      const min_quantity = findByKeywords(["min", "q.ta min", "qta min", "quantita min", "minimum"], reserved);

      setSheet(parsed);
      setMapping({
        name:  suggested.name  ?? "",
        unit:  suggested.unit  ?? "",
        price: suggested.price ?? "",
        brand, description, origin, min_quantity,
      });
      const haveRequired = Boolean(suggested.name && suggested.price);
      setAutoDetected(haveRequired);
      setShowMappingEditor(!haveRequired);
      setStep("preview");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Errore lettura file";
      toast.error(msg);
    }
  };

  const validated: ValidatedRow[] = useMemo(() => {
    if (!sheet) return [];
    return sheet.rows.map((r) => {
      const name = (r[mapping.name] ?? "").trim();
      const unitRaw = (r[mapping.unit] ?? "").trim();
      const priceRaw = (r[mapping.price] ?? "").trim();

      const raw = {
        name, unit: unitRaw, price: priceRaw,
        brand: mapping.brand ? (r[mapping.brand] ?? "").trim() : "",
        description: mapping.description ? (r[mapping.description] ?? "").trim() : "",
        origin: mapping.origin ? (r[mapping.origin] ?? "").trim() : "",
        min_quantity: mapping.min_quantity ? (r[mapping.min_quantity] ?? "").trim() : "",
      };

      if (!name) return { ok: false, reason: "Nome vuoto", raw };
      // Fallback chain: explicit cell → embedded in name → "pz".
      let unit = normalizeUnitToEnum(unitRaw);
      if (!unit) {
        const fromName = extractUnitFromText(name);
        if (fromName) {
          // Strip leading number to expose the unit token
          const onlyUnit = fromName.replace(/^\d+(?:[.,]\d+)?/, "");
          unit = normalizeUnitToEnum(onlyUnit);
        }
      }
      if (!unit) unit = "pz";
      const price = normalizePrice(priceRaw);
      if (price === null || price <= 0) return { ok: false, reason: "Prezzo non valido", raw };

      let min_quantity: number | null = null;
      if (raw.min_quantity) {
        const mq = normalizePrice(raw.min_quantity);
        if (mq !== null && mq > 0) min_quantity = mq;
      }

      return {
        ok: true,
        data: {
          name,
          unit,
          price,
          brand:        raw.brand || null,
          description:  raw.description || null,
          origin:       raw.origin || null,
          min_quantity,
        },
      };
    });
  }, [sheet, mapping]);

  const validCount = validated.filter((v) => v.ok).length;
  const invalidCount = validated.length - validCount;
  const mappingComplete = Boolean(mapping.name && mapping.price);

  if (!open) return null;

  const confirmImport = () => {
    const valid = validated
      .filter((v): v is Extract<ValidatedRow, { ok: true }> => v.ok)
      .map((v) => v.data);
    if (valid.length === 0) { toast.error("Nessuna riga valida da importare"); return; }
    if (!categoryId) { toast.error("Seleziona una categoria di default"); return; }
    startTransition(async () => {
      const res = await importSupplierProducts(valid, { categoryId, skipDuplicates });
      if (!res.ok) { toast.error(res.error); return; }
      const { inserted, skipped } = res.data;
      toast.success(`Importati ${inserted} prodotti${skipped ? ` — ${skipped} duplicati saltati` : ""}`);
      onImported?.();
      closeAll();
    });
  };

  const optionalField = (key: "brand" | "description" | "origin" | "min_quantity", label: string) => (
    <label key={key} className="block">
      <span className="text-sm text-sage">{label}</span>
      <select
        value={mapping[key]}
        onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value }))}
        className="mt-1 w-full rounded-lg bg-white border border-sage/30 px-3 py-2 text-charcoal"
      >
        <option value="">—</option>
        {sheet?.headers.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeAll}>
      <div
        className="w-full max-w-3xl rounded-xl bg-white border border-sage/20 p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-charcoal">Importa prodotti da file</h2>
          <div className="text-xs text-sage">{step === "upload" ? "1/2 Carica" : "2/2 Anteprima"}</div>
        </header>

        {step === "upload" && (
          <div className="space-y-4">
            <label className="block rounded-xl border-2 border-dashed border-sage/30 p-12 text-center cursor-pointer hover:border-forest/40">
              <UploadCloud className="mx-auto h-8 w-8 text-sage" />
              <p className="mt-3 text-charcoal">Trascina o clicca per caricare il tuo listino</p>
              <p className="mt-1 text-xs text-sage">CSV, XLS, XLSX · max 2MB · max 5000 righe</p>
              <p className="mt-2 text-xs text-sage">
                Riconosce automaticamente <strong>nome</strong>, <strong>unità/peso</strong>, <strong>prezzo</strong>,
                brand, origine e quantità minima.
              </p>
              <input type="file" accept=".csv,.xls,.xlsx" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </label>
            <details className="text-sm text-sage">
              <summary className="cursor-pointer hover:text-charcoal">Opzioni avanzate</summary>
              <label className="mt-2 flex items-center gap-2">
                <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
                Il file ha un&apos;intestazione sulla prima riga
              </label>
            </details>
            <a href="/template-prodotti.csv" download
              className="inline-flex items-center gap-1 text-sm text-forest hover:underline">
              <Download className="h-4 w-4" /> Scarica template CSV
            </a>
          </div>
        )}

        {step === "preview" && sheet && (
          <div className="space-y-4">
            <div className={`rounded-lg border px-3 py-2 text-sm flex items-start justify-between gap-3 ${
              autoDetected
                ? "bg-forest/5 border-forest/30 text-charcoal"
                : "bg-amber-50 border-amber-300 text-charcoal"
            }`}>
              <div className="flex items-start gap-2 min-w-0">
                <Wand2 className="h-4 w-4 mt-0.5 shrink-0 text-forest" />
                <div className="min-w-0">
                  <p className="font-medium">
                    {autoDetected ? "Colonne riconosciute automaticamente" : "Colonne da confermare"}
                  </p>
                  <p className="mt-0.5 text-sage truncate">
                    Nome: <span className="text-charcoal">{mapping.name || "—"}</span>
                    {" · "}Unità: <span className="text-charcoal">{mapping.unit || "—"}</span>
                    {" · "}Prezzo: <span className="text-charcoal">{mapping.price || "—"}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMappingEditor((s) => !s)}
                className="inline-flex items-center gap-1 text-xs text-forest hover:underline shrink-0"
              >
                <Pencil className="h-3 w-3" /> {showMappingEditor ? "Chiudi" : "Modifica"}
              </button>
            </div>

            {showMappingEditor && (
              <div className="rounded-lg border border-sage/20 p-3 space-y-3">
                <div>
                  <p className="text-sm font-medium text-charcoal mb-2">Colonne obbligatorie</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(["name", "unit", "price"] as const).map((field) => (
                      <label key={field} className="block">
                        <span className="text-sm text-sage">
                          {field === "name" ? "Nome prodotto" : field === "unit" ? "Unità" : "Prezzo"} *
                        </span>
                        <select
                          value={mapping[field]}
                          onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}
                          className="mt-1 w-full rounded-lg bg-white border border-sage/30 px-3 py-2 text-charcoal"
                        >
                          <option value="">—</option>
                          {sheet.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-charcoal mb-2">Colonne opzionali</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {optionalField("brand", "Brand / Marca")}
                    {optionalField("origin", "Origine")}
                    {optionalField("description", "Descrizione")}
                    {optionalField("min_quantity", "Quantità minima")}
                  </div>
                </div>
                <div className="rounded-lg border border-sage/20 overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-cream text-sage">
                      <tr>{sheet.headers.map((h) => <th key={h} className="text-left px-2 py-1 font-medium">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {sheet.rows.slice(0, 3).map((r, i) => (
                        <tr key={i} className="border-t border-sage/10">
                          {sheet.headers.map((h) => <td key={h} className="px-2 py-1 text-charcoal">{r[h]}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <label className="block">
              <span className="text-sm font-medium text-charcoal">Categoria di default *</span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1 w-full rounded-lg bg-white border border-sage/30 px-3 py-2 text-charcoal"
              >
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <span className="mt-1 block text-xs text-sage">Applicata a tutte le righe importate.</span>
            </label>

            <div className="flex items-center gap-4 text-sm">
              <span className="inline-flex items-center gap-1 text-forest"><Check className="h-4 w-4" /> {validCount} valide</span>
              <span className="text-red-600">{invalidCount} scartate</span>
            </div>

            <div className="rounded-lg border border-sage/20 max-h-64 overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-cream text-sage sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1 font-medium">Stato</th>
                    <th className="text-left px-2 py-1 font-medium">Nome</th>
                    <th className="text-left px-2 py-1 font-medium">Unità</th>
                    <th className="text-right px-2 py-1 font-medium">Prezzo</th>
                    <th className="text-left px-2 py-1 font-medium">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {validated.map((v, i) => (
                    <tr key={i} className="border-t border-sage/10">
                      {v.ok ? (
                        <>
                          <td className="px-2 py-1 text-forest">OK</td>
                          <td className="px-2 py-1 text-charcoal">{v.data.name}</td>
                          <td className="px-2 py-1 text-sage">{v.data.unit}</td>
                          <td className="px-2 py-1 text-right text-charcoal tabular-nums">€ {v.data.price.toFixed(2)}</td>
                          <td className="px-2 py-1" />
                        </>
                      ) : (
                        <>
                          <td className="px-2 py-1 text-red-600">✗</td>
                          <td className="px-2 py-1 text-sage">{v.raw.name || "—"}</td>
                          <td className="px-2 py-1 text-sage">{v.raw.unit || "—"}</td>
                          <td className="px-2 py-1 text-right text-sage tabular-nums">{v.raw.price || "—"}</td>
                          <td className="px-2 py-1 text-red-600">{v.reason}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-charcoal">
              <input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} />
              Salta prodotti con nome già presente in catalogo
            </label>

            <div className="flex justify-between">
              <button onClick={() => setStep("upload")} className="inline-flex items-center gap-1 text-sage hover:text-charcoal">
                <ArrowLeft className="h-4 w-4" /> Cambia file
              </button>
              <button
                onClick={confirmImport}
                disabled={pending || validCount === 0 || !mappingComplete}
                className="px-4 py-2 rounded-lg bg-forest text-white font-medium disabled:opacity-50"
              >
                {pending ? "Importo..." : `Conferma (${validCount} righe)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
