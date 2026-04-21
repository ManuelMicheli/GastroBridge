"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Upload, AlertTriangle, CheckCircle2, ArrowLeft } from "lucide-react";
import {
  previewFiscalCsv,
  importFiscalCsv,
  type CsvImportResult,
} from "@/lib/fiscal/csv-import";
import type { CsvMapping, CsvPreview } from "@/lib/fiscal/csv";

const FIELDS: Array<{
  key: keyof CsvMapping;
  label: string;
  required: boolean;
}> = [
  { key: "receipt_external_id", label: "ID Scontrino", required: true },
  { key: "issued_at", label: "Data/ora", required: true },
  { key: "business_day", label: "Giornata fiscale", required: false },
  { key: "line_number", label: "Numero riga", required: true },
  { key: "item_name", label: "Nome articolo", required: true },
  { key: "category", label: "Categoria", required: false },
  { key: "quantity", label: "Quantità", required: true },
  { key: "unit_price", label: "Prezzo unitario (€ o cents)", required: true },
  { key: "vat_rate", label: "Aliquota IVA %", required: false },
  { key: "discount", label: "Sconto", required: false },
  { key: "payment_method", label: "Metodo pagamento", required: false },
  { key: "total", label: "Totale scontrino", required: false },
  { key: "operator", label: "Operatore", required: false },
  { key: "covers", label: "Coperti", required: false },
  { key: "table_ref", label: "Tavolo", required: false },
  { key: "is_voided", label: "Annullato (sì/no)", required: false },
];

type Props = { restaurantId: string };

export function CsvClient({ restaurantId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState<string>("");
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [mapping, setMapping] = useState<Partial<CsvMapping>>({});
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CsvImportResult | null>(null);

  function onFile(f: File) {
    setFile(f);
    setError(null);
    setResult(null);
    setPreview(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setContent(text);
      startTransition(async () => {
        try {
          const p = await previewFiscalCsv(restaurantId, text);
          setPreview(p);
          setMapping(
            p.autoMapping ? { ...p.autoMapping } : {},
          );
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        }
      });
    };
    reader.readAsText(f);
  }

  function setField(key: keyof CsvMapping, value: string) {
    setMapping((m) => ({ ...m, [key]: value || undefined }));
  }

  async function submit() {
    if (!preview || !content) return;
    const required: Array<keyof CsvMapping> = [
      "receipt_external_id",
      "issued_at",
      "line_number",
      "item_name",
      "quantity",
      "unit_price",
    ];
    const missing = required.filter((k) => !mapping[k]);
    if (missing.length > 0) {
      setError(`Mappa i campi obbligatori: ${missing.join(", ")}`);
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const res = await importFiscalCsv({
          restaurant_id: restaurantId,
          display_name: displayName || undefined,
          mapping: mapping as CsvMapping,
          content,
        });
        setResult(res);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link
          href={`/finanze/integrazioni?r=${restaurantId}`}
          className="text-text-tertiary hover:text-text-secondary"
          aria-label="Torna alle integrazioni"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-tertiary font-bold">
            Cassetto Fiscale · Import
          </p>
          <h1 className="text-2xl font-semibold text-text-primary">
            Carica scontrini da CSV
          </h1>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-accent-orange/10 border border-accent-orange/30 rounded-xl px-4 py-3 text-sm text-accent-orange">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="bg-accent-green/10 border border-accent-green/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-accent-green">
            <CheckCircle2 className="h-5 w-5" />
            <p className="text-sm font-medium">
              Import completato: {result.receipts_inserted} scontrini
              {result.rows_with_errors > 0 &&
                `, ${result.rows_with_errors} righe con errori`}
              .
            </p>
          </div>
          {result.errors.length > 0 && (
            <ul className="text-xs text-text-secondary space-y-0.5">
              {result.errors.map((e, i) => (
                <li key={i} className="font-mono">
                  riga {e.row}: {e.message}
                </li>
              ))}
            </ul>
          )}
          <Link
            href={`/finanze/scontrini?r=${restaurantId}&integration=${result.integration_id}`}
            className="inline-block text-sm text-accent-green hover:underline"
          >
            Vedi scontrini →
          </Link>
        </div>
      )}

      <section className="bg-surface-card border border-border-subtle rounded-2xl p-5 lg:p-6 space-y-4">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
            File CSV
          </label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
            className="block w-full text-sm text-text-secondary file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-accent-green file:text-surface-base file:cursor-pointer hover:file:bg-accent-green/90"
          />
          {file && (
            <p className="text-xs text-text-tertiary mt-2">
              {file.name} · {(file.size / 1024).toFixed(1)} KB
            </p>
          )}
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
            Nome integrazione (opzionale)
          </label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="es. Import marzo 2026"
            className="w-full bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary"
          />
        </div>
      </section>

      {preview && (
        <>
          <section className="bg-surface-card border border-border-subtle rounded-2xl p-5 lg:p-6">
            <h2 className="text-sm font-medium text-text-secondary mb-1">
              Anteprima ({preview.rowCount} righe totali)
            </h2>
            <p className="text-xs text-text-tertiary mb-4">
              {preview.autoMapping
                ? "Mapping auto-rilevato dalle intestazioni. Puoi modificarlo."
                : `Mapping manuale richiesto. Campi mancanti: ${preview.autoMappingMissing.join(", ")}`}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-tertiary uppercase tracking-wider">
                    {preview.headers.map((h) => (
                      <th
                        key={h}
                        className="text-left px-3 py-2 font-medium whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 6).map((row, i) => (
                    <tr
                      key={i}
                      className="border-t border-border-subtle text-text-secondary"
                    >
                      {preview.headers.map((h) => (
                        <td
                          key={h}
                          className="px-3 py-2 whitespace-nowrap font-mono"
                        >
                          {row[h] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-surface-card border border-border-subtle rounded-2xl p-5 lg:p-6">
            <h2 className="text-sm font-medium text-text-secondary mb-4">
              Mappatura colonne
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="block text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
                    {f.label}
                    {f.required && (
                      <span className="text-accent-orange ml-0.5">*</span>
                    )}
                  </label>
                  <select
                    value={mapping[f.key] ?? ""}
                    onChange={(e) => setField(f.key, e.target.value)}
                    className="w-full bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary"
                  >
                    <option value="">— non mappato —</option>
                    {preview.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <Link
                href={`/finanze/integrazioni?r=${restaurantId}`}
                className="text-sm text-text-secondary hover:text-text-primary px-3 py-2"
              >
                Annulla
              </Link>
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="inline-flex items-center gap-2 bg-accent-green text-surface-base text-sm font-medium rounded-lg px-4 py-2 hover:bg-accent-green/90 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                Importa {preview.rowCount} righe
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
