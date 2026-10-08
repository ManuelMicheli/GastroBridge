// app/(app)/cerca/_components/import-wizard.tsx
"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check, Download, Settings2, Sparkles, UploadCloud } from "lucide-react";
import { parseCsv, parseXlsx, suggestMapping, type ParsedSheet } from "@/lib/catalogs/parse-file";
import { normalizeName, normalizeUnit } from "@/lib/catalogs/normalize";
import { NameIndex } from "@/lib/import/match/similarity";
import type { OrderLine as ParsedOrderLine } from "@/lib/import/understand/order-lines";
import { SmartDropzone } from "@/components/import/smart-dropzone";
import type { Group, OrderLine } from "../_lib/types";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 5000;

type WizardStep = "upload" | "map" | "preview";
type WizardMode = "smart" | "advanced";
type Mapping = { name: string; unit: string; qty: string };
type ValidatedRow =
  | { ok: true; matchType: "exact" | "name" | "none"; matchedKey: string | null; productName: string; unit: string; qty: number; rawName: string; rawUnit: string }
  | { ok: false; reason: string; raw: { name: string; unit: string; qty: string } };

export function ImportWizard({
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
  // Smart mode: drop / paste anything ("10 kg farina", WhatsApp list, photo…)
  const [wizardMode, setWizardMode] = useState<WizardMode>("smart");
  const [smartLines, setSmartLines] = useState<ParsedOrderLine[] | null>(null);
  const [smartSkipped, setSmartSkipped] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  const reset = () => {
    setStep("upload");
    setSheet(null);
    setMapping({ name: "", unit: "", qty: "" });
    setError(null);
    setSmartLines(null);
    setSmartSkipped(0);
    setBusy(null);
  };

  const runSmart = async (load: () => Promise<import("@/lib/import/types").SourceDoc>) => {
    setError(null);
    setBusy("Lettura in corso…");
    try {
      const doc = await load();
      const { parseOrderLines } = await import("@/lib/import/understand/order-lines");
      const { lines, skipped } = parseOrderLines(doc);
      if (lines.length === 0) {
        setError("Non abbiamo trovato righe con una quantità. Scrivi ad es. «10 kg farina 00» o «olio evo x 6».");
        return;
      }
      if (lines.length > MAX_ROWS) {
        setError(`Troppe righe (max ${MAX_ROWS})`);
        return;
      }
      setSmartLines(lines);
      setSmartSkipped(skipped);
      setStep("preview");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore lettura");
    } finally {
      setBusy(null);
    }
  };
  const closeAll = () => { reset(); onClose(); };

  const groupByNormKey = useMemo(() => {
    const m = new Map<string, Group>();
    for (const g of groups) m.set(`${normalizeName(g.productName)}::${normalizeUnit(g.unit)}`, g);
    return m;
  }, [groups]);

  const groupsByName = useMemo(() => {
    const m = new Map<string, Group>();
    for (const g of groups) {
      const nk = normalizeName(g.productName);
      if (!m.has(nk)) m.set(nk, g);
    }
    return m;
  }, [groups]);

  const fuzzyIndex = useMemo(() => new NameIndex(groups, (g) => g.productName), [groups]);

  const validated: ValidatedRow[] = useMemo(() => {
    const source: Array<{ name: string; unit: string; qtyRaw: string }> | null = smartLines
      ? smartLines.map((l) => ({ name: l.name, unit: l.unit ?? "", qtyRaw: String(l.qty) }))
      : sheet
        ? sheet.rows.map((r) => ({
            name: (r[mapping.name] ?? "").trim(),
            unit: (r[mapping.unit] ?? "").trim(),
            qtyRaw: (r[mapping.qty] ?? "").trim(),
          }))
        : null;
    if (!source) return [];
    return source.map(({ name, unit, qtyRaw }) => {

      if (!name) return { ok: false, reason: "Nome vuoto", raw: { name, unit, qty: qtyRaw } };
      const qtyNum = Number(qtyRaw.replace(",", "."));
      if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
        return { ok: false, reason: "Quantità non valida", raw: { name, unit, qty: qtyRaw } };
      }

      const nameNorm = normalizeName(name);
      const unitNorm = unit ? normalizeUnit(unit) : "";

      let matched: Group | undefined;
      let matchType: "exact" | "name" | "none" = "none";
      if (unit) {
        matched = groupByNormKey.get(`${nameNorm}::${unitNorm}`);
        if (matched) matchType = "exact";
      }
      if (!matched) {
        matched = groupsByName.get(nameNorm);
        if (matched) matchType = "name";
      }
      if (!matched) {
        const fz = fuzzyIndex.best(name, 0.72);
        if (fz) {
          matched = fz.item;
          matchType = "name";
        }
      }

      return {
        ok: true,
        matchType,
        matchedKey: matched ? matched.key : null,
        productName: matched?.productName ?? name,
        unit:        matched?.unit ?? (unit || "—"),
        qty:         qtyNum,
        rawName:     name,
        rawUnit:     unit,
      };
    });
  }, [sheet, smartLines, mapping, groupByNormKey, groupsByName, fuzzyIndex]);

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
  const exactCount = validRows.filter((v) => v.matchType === "exact").length;
  const fuzzyCount = validRows.filter((v) => v.matchType === "name").length;
  const unmatchedCount = validRows.filter((v) => v.matchType === "none").length;

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

  const stepLabel = smartLines
    ? step === "upload" ? "1 / 2 CARICA" : "2 / 2 VERIFICA"
    : step === "upload" ? "1 / 3 UPLOAD" : step === "map" ? "2 / 3 MAP" : "3 / 3 PREVIEW";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={closeAll}
      role="dialog"
      aria-modal="true"
      aria-label="Importa ordine tipico"
    >
      <div
        className="w-full max-w-3xl space-y-5 overflow-y-auto rounded-xl border border-border-subtle bg-surface-card p-6 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-text-primary">
            Importa ordine tipico
          </h2>
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
            {stepLabel}
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {step === "upload" && wizardMode === "smart" && (
          <div className="space-y-3">
            {busy ? (
              <div className="rounded-xl border border-border-subtle p-8 text-center text-sm text-text-secondary" role="status">
                <Sparkles className="mx-auto mb-2 h-6 w-6 animate-pulse text-accent-green" /> {busy}
              </div>
            ) : (
              <SmartDropzone
                title="Trascina la lista, una foto o un file"
                hint="Anche una nota o un messaggio: «10 kg farina 00, olio evo x 6, 3 casse di pomodori». Riconosciamo prodotti e quantità."
                placeholder={"10 kg farina 00\nolio evo x 6\npomodori pelati: 3 casse"}
                onFile={(file) =>
                  runSmart(async () => (await import("@/lib/import/formats/browser")).readFileAsSourceDoc(file, (_p, m) => setBusy(m)))
                }
                onText={(text) => runSmart(async () => (await import("@/lib/import/formats/browser")).pastedTextAsSourceDoc(text))}
              />
            )}
            <button
              type="button"
              onClick={() => setWizardMode("advanced")}
              className="inline-flex items-center gap-1 text-sm text-text-tertiary hover:text-text-primary"
            >
              <Settings2 className="h-4 w-4" /> Avanzato: scegli tu le colonne di un Excel/CSV
            </button>
          </div>
        )}

        {step === "upload" && wizardMode === "advanced" && (
          <div className="space-y-4">
            <button type="button" onClick={() => setWizardMode("smart")} className="inline-flex items-center gap-1 text-sm text-accent-green hover:underline">
              <Sparkles className="h-4 w-4" /> Torna all&apos;import automatico
            </button>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
              Il file ha un&apos;intestazione sulla prima riga
            </label>
            <label className="block rounded-xl border-2 border-dashed border-border-subtle p-12 text-center cursor-pointer hover:border-accent-green/40">
              <UploadCloud className="mx-auto h-8 w-8 text-text-tertiary" />
              <p className="mt-3 text-text-primary">Clicca per scegliere un file</p>
              <p className="mt-1 text-xs text-text-tertiary">CSV, XLS, XLSX · max 2MB · max 5000 righe</p>
              <p className="mt-1 text-xs text-text-tertiary">Colonne attese: nome, quantità (unità opzionale)</p>
              <input
                type="file" accept=".csv,.xls,.xlsx" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </label>
            <a
              href="data:text/csv;charset=utf-8,nome;quantita%0AFarina%2000;10%0AOlio%20EVO;5%0APomodoro%20pelato;8%0AAceto%20Balsamico%20di%20Modena%20IGP;2"
              download="template-ordine-tipico.csv"
              className="inline-flex items-center gap-1 text-sm text-accent-green hover:underline"
            >
              <Download className="h-4 w-4" /> Scarica template CSV
            </a>
          </div>
        )}

        {step === "map" && sheet && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(["name", "unit", "qty"] as const).map((field) => (
                <label key={field} className="block">
                  <span className="text-sm text-text-secondary">
                    {field === "name" ? "Nome prodotto *" : field === "unit" ? "Unità (opzionale)" : "Quantità *"}
                  </span>
                  <select
                    value={mapping[field]}
                    onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-text-primary"
                  >
                    <option value="">—</option>
                    {sheet.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div className="overflow-x-auto rounded-lg border border-border-subtle">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-base text-text-tertiary">
                  <tr>{sheet.headers.map((h) => <th key={h} className="px-2 py-1 text-left font-medium">{h}</th>)}</tr>
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
                disabled={!mapping.name || !mapping.qty}
                className="rounded-lg bg-accent-green px-4 py-2 font-medium text-surface-base disabled:opacity-50"
              >
                Continua
              </button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="inline-flex items-center gap-1 text-accent-green">
                <Check className="h-4 w-4" /> {exactCount} match esatti
              </span>
              {fuzzyCount > 0 && (
                <span className="text-accent-green">{fuzzyCount} match per nome</span>
              )}
              {unmatchedCount > 0 && (
                <span className="text-yellow-400">{unmatchedCount} non in catalogo</span>
              )}
              {invalidCount > 0 && <span className="text-red-400">{invalidCount} scartate</span>}
              {smartSkipped > 0 && <span className="text-text-tertiary">{smartSkipped} righe ignorate (senza quantità)</span>}
            </div>

            <div className="max-h-64 overflow-y-auto rounded-lg border border-border-subtle">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-surface-base text-text-tertiary">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium">Stato</th>
                    <th className="px-2 py-1 text-left font-medium">Nome</th>
                    <th className="px-2 py-1 text-left font-medium">Unità</th>
                    <th className="px-2 py-1 text-right font-medium">Q.tà</th>
                    <th className="px-2 py-1 text-left font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {validated.map((v, i) => (
                    <tr key={i} className="border-t border-border-subtle">
                      {v.ok ? (
                        <>
                          <td className="px-2 py-1">
                            {v.matchType === "exact" && <span className="text-accent-green">OK</span>}
                            {v.matchType === "name" && <span className="text-accent-green">~</span>}
                            {v.matchType === "none" && <span className="text-yellow-400">?</span>}
                          </td>
                          <td className="px-2 py-1 text-text-primary">{v.productName}</td>
                          <td className="px-2 py-1 text-text-secondary">{v.unit}</td>
                          <td className="px-2 py-1 text-right tabular-nums text-text-primary">{v.qty}</td>
                          <td className="px-2 py-1 text-xs text-text-tertiary">
                            {v.matchType === "exact" && "Match esatto nei cataloghi"}
                            {v.matchType === "name" && (
                              <>Match per nome{v.rawUnit ? <> (unità &quot;{v.rawUnit}&quot; → &quot;{v.unit}&quot;)</> : null}</>
                            )}
                            {v.matchType === "none" && "Non presente nei cataloghi"}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-2 py-1 text-red-400">✗</td>
                          <td className="px-2 py-1 text-text-tertiary">{v.raw.name || "—"}</td>
                          <td className="px-2 py-1 text-text-tertiary">{v.raw.unit || "—"}</td>
                          <td className="px-2 py-1 text-right tabular-nums text-text-tertiary">{v.raw.qty || "—"}</td>
                          <td className="px-2 py-1 text-xs text-red-400">{v.reason}</td>
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
              <button
                onClick={() => {
                  if (smartLines) {
                    setSmartLines(null);
                    setStep("upload");
                  } else setStep("map");
                }}
                className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary"
              >
                <ArrowLeft className="h-4 w-4" /> Indietro
              </button>
              <button
                onClick={confirmImport}
                disabled={validRows.length === 0}
                className="rounded-lg bg-accent-green px-4 py-2 font-medium text-surface-base disabled:opacity-50"
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
