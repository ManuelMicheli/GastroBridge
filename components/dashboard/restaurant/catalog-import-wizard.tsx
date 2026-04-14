"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { UploadCloud, Check, ArrowLeft, Download } from "lucide-react";
import { parseCsv, parseXlsx, suggestMapping, type ParsedSheet } from "@/lib/catalogs/parse-file";
import { normalizePrice } from "@/lib/catalogs/normalize";
import { importCatalogItems } from "@/lib/catalogs/actions";
import type { CatalogItemInput } from "@/lib/catalogs/schemas";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 5000;

type Mapping = { name: string; unit: string; price: string };
type Step = "upload" | "map" | "preview";
type ValidatedRow =
  | { ok: true; data: CatalogItemInput }
  | { ok: false; reason: string; raw: { name: string; unit: string; price: string } };

type Props = {
  open: boolean;
  onClose: () => void;
  catalogId: string;
  onImported?: () => void;
};

export function CatalogImportWizard({ open, onClose, catalogId, onImported }: Props) {
  const [step, setStep]       = useState<Step>("upload");
  const [hasHeader, setHasHeader] = useState(true);
  const [sheet, setSheet]     = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<Mapping>({ name: "", unit: "", price: "" });
  const [mode, setMode]       = useState<"replace" | "append">("append");
  const [pending, startTransition] = useTransition();

  const reset = () => { setStep("upload"); setSheet(null); setMapping({ name: "", unit: "", price: "" }); };
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

      setSheet(parsed);
      const suggested = suggestMapping(parsed.headers);
      setMapping({
        name:  suggested.name  ?? parsed.headers[0] ?? "",
        unit:  suggested.unit  ?? parsed.headers[1] ?? "",
        price: suggested.price ?? parsed.headers[2] ?? "",
      });
      setStep("map");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Errore lettura file";
      toast.error(msg);
    }
  };

  const validated: ValidatedRow[] = useMemo(() => {
    if (!sheet) return [];
    return sheet.rows.map((r) => {
      const name = (r[mapping.name] ?? "").trim();
      const unit = (r[mapping.unit] ?? "").trim();
      const priceRaw = (r[mapping.price] ?? "").trim();

      if (!name)  return { ok: false, reason: "Nome vuoto",  raw: { name, unit, price: priceRaw } };
      if (!unit)  return { ok: false, reason: "Unità vuota", raw: { name, unit, price: priceRaw } };
      const price = normalizePrice(priceRaw);
      if (price === null) return { ok: false, reason: "Prezzo non valido", raw: { name, unit, price: priceRaw } };

      return { ok: true, data: { product_name: name, unit, price, notes: null } };
    });
  }, [sheet, mapping]);

  const validCount = validated.filter((v) => v.ok).length;
  const invalidCount = validated.length - validCount;

  if (!open) return null;

  const confirmImport = () => {
    const valid = validated.filter((v): v is Extract<ValidatedRow, { ok: true }> => v.ok).map((v) => v.data);
    if (valid.length === 0) { toast.error("Nessuna riga valida da importare"); return; }
    startTransition(async () => {
      const res = await importCatalogItems(catalogId, valid, mode);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`Importate ${res.data.inserted} righe`);
      onImported?.();
      closeAll();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeAll}>
      <div className="w-full max-w-3xl rounded-xl bg-surface-card border border-border-subtle p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Importa catalogo da file</h2>
          <div className="text-xs text-text-tertiary">
            {step === "upload" ? "1/3 Upload" : step === "map" ? "2/3 Mappa colonne" : "3/3 Anteprima"}
          </div>
        </header>

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
              <input type="file" accept=".csv,.xls,.xlsx" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </label>
            <a href="/template-catalogo.csv" download
              className="inline-flex items-center gap-1 text-sm text-accent-green hover:underline">
              <Download className="h-4 w-4" /> Scarica template CSV
            </a>
          </div>
        )}

        {step === "map" && sheet && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(["name", "unit", "price"] as const).map((field) => (
                <label key={field} className="block">
                  <span className="text-sm text-text-secondary capitalize">
                    {field === "name" ? "Nome prodotto" : field === "unit" ? "Unità" : "Prezzo"} *
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
                disabled={!mapping.name || !mapping.unit || !mapping.price}
                className="px-4 py-2 rounded-lg bg-accent-green text-surface-base font-medium disabled:opacity-50"
              >
                Continua
              </button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm">
              <span className="inline-flex items-center gap-1 text-accent-green"><Check className="h-4 w-4" /> {validCount} valide</span>
              <span className="text-red-400">{invalidCount} scartate</span>
            </div>

            <div className="rounded-lg border border-border-subtle max-h-64 overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-base text-text-tertiary sticky top-0">
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
                    <tr key={i} className="border-t border-border-subtle">
                      {v.ok ? (
                        <>
                          <td className="px-2 py-1 text-accent-green">OK</td>
                          <td className="px-2 py-1 text-text-primary">{v.data.product_name}</td>
                          <td className="px-2 py-1 text-text-secondary">{v.data.unit}</td>
                          <td className="px-2 py-1 text-right text-text-primary tabular-nums">€ {v.data.price.toFixed(2)}</td>
                          <td className="px-2 py-1" />
                        </>
                      ) : (
                        <>
                          <td className="px-2 py-1 text-red-400">✗</td>
                          <td className="px-2 py-1 text-text-tertiary">{v.raw.name || "—"}</td>
                          <td className="px-2 py-1 text-text-tertiary">{v.raw.unit || "—"}</td>
                          <td className="px-2 py-1 text-right text-text-tertiary tabular-nums">{v.raw.price || "—"}</td>
                          <td className="px-2 py-1 text-red-400">{v.reason}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <fieldset className="flex gap-4 text-sm">
              <label className="inline-flex items-center gap-1">
                <input type="radio" checked={mode === "append"} onChange={() => setMode("append")} /> Aggiungi al catalogo
              </label>
              <label className="inline-flex items-center gap-1">
                <input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} /> Sostituisci catalogo
              </label>
            </fieldset>

            <div className="flex justify-between">
              <button onClick={() => setStep("map")} className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary">
                <ArrowLeft className="h-4 w-4" /> Indietro
              </button>
              <button
                onClick={confirmImport}
                disabled={pending || validCount === 0}
                className="px-4 py-2 rounded-lg bg-accent-green text-surface-base font-medium disabled:opacity-50"
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
