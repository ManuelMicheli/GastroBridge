"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { uploadInvoiceDocuments } from "@/lib/invoices/actions";
import { extractInvoiceDocuments, type ExtractedDocument } from "@/lib/invoices/archive";
import { stripAttachments } from "@/lib/invoices/fatturapa";
import { cn } from "@/lib/utils/formatters";

const MAX_DOC_CHARS = 940_000;
const BATCH_CHARS = 800_000;
const BATCH_DOCS = 40;

type ImportedRow = { id: string; supplierName: string | null; number: string; openCents: number; findings: number; documentType: string };

type Summary = {
  imported: ImportedRow[];
  already: number;
  problems: Array<{ fileName: string; reason: string }>;
};

const eur = new Intl.NumberFormat("it-IT", { useGrouping: "always", style: "currency", currency: "EUR" });

function batches(docs: Array<{ fileName: string; xml: string; sourceKind: ExtractedDocument["sourceKind"] }>) {
  const out: (typeof docs)[] = [];
  let cur: typeof docs = [];
  let size = 0;
  for (const d of docs) {
    if (cur.length > 0 && (size + d.xml.length > BATCH_CHARS || cur.length >= BATCH_DOCS)) {
      out.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(d);
    size += d.xml.length;
  }
  if (cur.length > 0) out.push(cur);
  return out;
}

/**
 * Drag & drop import of FatturaPA files: .xml, .xml.p7m (also base64) and
 * .zip (e.g. the bulk download of «Fatture e Corrispettivi»). Archives and
 * signatures are opened in the browser, attachments are stripped and the XML
 * is sent in small batches; the server re-parses and checks everything.
 */
export function InvoiceUpload({
  canWrite,
  compact = false,
  title = "Carica fatture",
  hint = "Trascina qui i file .xml, .p7m o lo .zip scaricato dal cassetto fiscale.",
}: {
  canWrite: boolean;
  compact?: boolean;
  title?: string;
  hint?: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  async function handle(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0 || busy) return;
    setSummary(null);
    const problems: Summary["problems"] = [];
    const docs: Array<{ fileName: string; xml: string; sourceKind: ExtractedDocument["sourceKind"] }> = [];
    setBusy("Apro i file…");
    for (const f of list) {
      try {
        const bytes = new Uint8Array(await f.arrayBuffer());
        const ex = extractInvoiceDocuments(f.name, bytes);
        for (const s of ex.skipped) {
          // Metadata / SDI receipts inside the AdE zip are expected: don't alarm.
          if (/metadati|notifica|ricevuta/i.test(s.reason)) continue;
          problems.push(s);
        }
        for (const d of ex.documents) {
          const xml = stripAttachments(d.xml);
          if (xml.length > MAX_DOC_CHARS) problems.push({ fileName: d.fileName, reason: "Fattura troppo grande anche senza allegati" });
          else docs.push({ fileName: d.fileName.slice(0, 300), xml, sourceKind: d.sourceKind });
        }
      } catch {
        problems.push({ fileName: f.name, reason: "File non leggibile" });
      }
    }
    const result: Summary = { imported: [], already: 0, problems };
    const groups = batches(docs);
    for (let i = 0; i < groups.length; i++) {
      setBusy(groups.length > 1 ? `Controllo le fatture… ${i + 1}/${groups.length}` : "Controllo le fatture…");
      const res = await uploadInvoiceDocuments(groups[i]);
      if (!res.ok) {
        result.problems.push(...groups[i]!.map((d) => ({ fileName: d.fileName, reason: res.error })));
        continue;
      }
      result.imported.push(...res.data.imported);
      result.already += res.data.alreadyImported.length;
      result.problems.push(...res.data.errors);
    }
    if (docs.length === 0 && problems.length === 0) problems.push({ fileName: list[0]!.name, reason: "Nessuna fattura trovata nel file" });
    setBusy(null);
    setSummary(result);
    if (result.imported.length > 0) router.refresh();
  }

  if (!canWrite) {
    return compact ? null : (
      <p className="text-[13px] text-[var(--f-muted)]">Il tuo ruolo può consultare le fatture ma non caricarne di nuove.</p>
    );
  }

  const withIssues = summary?.imported.filter((i) => i.findings > 0) ?? [];
  const found = withIssues.reduce((s, i) => s + i.openCents, 0);

  return (
    <div id="carica" className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        aria-label={title}
        onClick={() => !busy && input.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !busy) {
            e.preventDefault();
            input.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void handle(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[16px] border-[1.5px] border-dashed px-4 text-center transition-colors",
          compact ? "py-5" : "py-8",
          drag
            ? "border-[var(--acc-600)] bg-[var(--acc-50)]"
            : "border-[var(--f-line-strong)] bg-[var(--f-fill)] hover:border-[var(--acc-400)]",
          busy && "pointer-events-none opacity-80",
        )}
      >
        {busy ? (
          <Loader2 className="h-6 w-6 animate-spin text-[var(--acc-600)]" aria-hidden />
        ) : (
          <FileUp className="h-6 w-6 text-[var(--acc-600)]" aria-hidden />
        )}
        <p className="text-[14px] font-medium text-[var(--f-ink)]">{busy ?? title}</p>
        {!busy && <p className="max-w-[46ch] text-[12.5px] text-[var(--f-muted)]">{hint}</p>}
        <input
          ref={input}
          type="file"
          multiple
          accept=".xml,.p7m,.zip,application/xml,text/xml,application/zip,application/pkcs7-mime"
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) void handle(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {summary && (
        <div className="rounded-[14px] border border-[var(--f-line)] bg-[var(--f-card)] p-4 text-[13.5px]" role="status">
          {summary.imported.length > 0 ? (
            <p className="flex items-start gap-2 font-medium text-[var(--f-ink)]">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--f-success)]" aria-hidden />
              <span>
                {summary.imported.length === 1 ? "1 fattura importata" : `${summary.imported.length} fatture importate`}
                {withIssues.length > 0
                  ? ` · ${withIssues.length} con anomalie${found > 0 ? ` (${eur.format(found / 100)} da recuperare)` : ""}`
                  : " · tutto in ordine"}
                .
              </span>
            </p>
          ) : null}
          {summary.already > 0 && (
            <p className="mt-1 text-[var(--f-muted)]">
              {summary.already === 1 ? "1 file era già stato importato" : `${summary.already} file erano già stati importati`}.
            </p>
          )}
          {withIssues.length > 0 && (
            <ul className="mt-2 space-y-1">
              {withIssues.slice(0, 6).map((i) => (
                <li key={i.id}>
                  <Link href={`/finanze/fatture/${i.id}`} className="text-[var(--acc-ink)] underline-offset-2 hover:underline">
                    {i.supplierName ?? "Fornitore"} · n. {i.number}
                    {i.openCents > 0 ? ` · ${eur.format(i.openCents / 100)}` : ""}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {summary.problems.length > 0 && (
            <div className="mt-2">
              <p className="flex items-center gap-1.5 text-[var(--f-warning)]">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                {summary.problems.length === 1 ? "1 file non importato" : `${summary.problems.length} file non importati`}
              </p>
              <ul className="mt-1 max-h-32 space-y-0.5 overflow-y-auto text-[12.5px] text-[var(--f-muted)]">
                {summary.problems.slice(0, 30).map((p, i) => (
                  <li key={`${p.fileName}-${i}`}>
                    <span className="font-medium text-[var(--f-ink-2)]">{p.fileName}</span>: {p.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
