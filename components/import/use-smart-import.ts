"use client";

// Drives one smart import: read the file in the browser (PDF text / OCR /
// Excel / CSV / pasted text) → POST /api/import/analyze (NDJSON progress) →
// result for the review screen. If the server is unreachable the same local
// engine runs in the browser (without memory and comparisons).

import { useCallback, useRef, useState } from "react";
import type { AnalyzeContextPayload, AnalyzeEvent, AnalyzeRequest, ImportPersona } from "@/lib/import/api-types";
import { IMPORT_LIMITS } from "@/lib/import/api-types";
import type { ColumnRole, ExtractionResult, SourceDoc } from "@/lib/import/types";

export type ImportPhase = "idle" | "reading" | "analyzing" | "review" | "error";

export type SmartImportState = {
  phase: ImportPhase;
  progress: number;
  message: string;
  error: string | null;
  result: ExtractionResult | null;
  context: AnalyzeContextPayload | null;
  memoryUsed: boolean;
  offline: boolean;
  sourceLabel: string | null;
};

const INITIAL: SmartImportState = {
  phase: "idle",
  progress: 0,
  message: "",
  error: null,
  result: null,
  context: null,
  memoryUsed: false,
  offline: false,
  sourceLabel: null,
};

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function useSmartImport(persona: ImportPersona, opts: { targetCatalogId?: string | null } = {}) {
  const [state, setState] = useState<SmartImportState>(INITIAL);
  const docRef = useRef<SourceDoc | null>(null);
  const runId = useRef(0);

  const setProgress = (id: number, progress: number, message: string, phase?: ImportPhase) => {
    if (id !== runId.current) return;
    setState((s) => ({ ...s, progress: Math.max(0, Math.min(1, progress)), message, ...(phase ? { phase } : {}) }));
  };

  const analyzeDoc = useCallback(
    async (doc: SourceDoc, id: number, columnOverrides?: Record<string, Record<number, ColumnRole>>) => {
      docRef.current = doc;
      setProgress(id, 0.02, "Analisi del contenuto", "analyzing");
      const body: AnalyzeRequest = { persona, doc, targetCatalogId: opts.targetCatalogId ?? null, columnOverrides };
      const json = JSON.stringify(body);
      if (json.length > IMPORT_LIMITS.maxBodyBytes) {
        throw new HttpError(413, "Il documento è troppo grande per un solo import: dividilo in più file (es. un foglio alla volta).");
      }
      let res: Response;
      try {
        res = await fetch("/api/import/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: json });
      } catch {
        return analyzeOffline(doc, id);
      }
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        if (res.status >= 500) return analyzeOffline(doc, id);
        throw new HttpError(res.status, j?.error ?? "Analisi non riuscita.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      while (!done) {
        const chunk = await reader.read();
        done = chunk.done;
        buf += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !done });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line) as AnalyzeEvent;
          if (id !== runId.current) return;
          if (ev.type === "progress") setProgress(id, 0.1 + ev.progress * 0.9, ev.message);
          else if (ev.type === "error") throw new HttpError(500, ev.message);
          else if (ev.type === "result") {
            setState((s) => ({ ...s, phase: "review", progress: 1, message: "", result: ev.result, context: ev.context, memoryUsed: ev.memoryUsed, offline: false }));
            return;
          }
        }
      }
      throw new HttpError(500, "Risposta incompleta dal server.");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persona, opts.targetCatalogId],
  );

  const analyzeOffline = async (doc: SourceDoc, id: number) => {
    setProgress(id, 0.3, "Server non raggiungibile: analisi sul dispositivo");
    const { localExtractor } = await import("@/lib/import/engine");
    const result = await localExtractor.extract(doc, {
      persona,
      onProgress: (p) => setProgress(id, 0.3 + p.progress * 0.7, p.message),
    });
    if (id !== runId.current) return;
    result.warnings.unshift("Analisi fatta sul dispositivo: confronto con i listini esistenti non disponibile.");
    setState((s) => ({ ...s, phase: "review", progress: 1, message: "", result, context: null, memoryUsed: false, offline: true }));
  };

  const fail = (id: number, err: unknown) => {
    if (id !== runId.current) return;
    const message = err instanceof Error && err.message ? err.message : "Qualcosa è andato storto. Riprova.";
    setState((s) => ({ ...s, phase: "error", error: message }));
  };

  const analyzeFile = useCallback(
    async (file: File) => {
      const id = ++runId.current;
      setState({ ...INITIAL, phase: "reading", progress: 0.01, message: "Apertura del file", sourceLabel: file.name });
      try {
        const { readFileAsSourceDoc } = await import("@/lib/import/formats/browser");
        const doc = await readFileAsSourceDoc(file, (p, m) => setProgress(id, p * 0.6, m));
        if (id !== runId.current) return;
        await analyzeDoc(doc, id);
      } catch (err) {
        fail(id, err);
      }
    },
    [analyzeDoc],
  );

  const analyzeText = useCallback(
    async (text: string) => {
      const id = ++runId.current;
      setState({ ...INITIAL, phase: "reading", progress: 0.05, message: "Lettura del testo", sourceLabel: "Testo incollato" });
      try {
        const { pastedTextAsSourceDoc } = await import("@/lib/import/formats/browser");
        await analyzeDoc(pastedTextAsSourceDoc(text), id);
      } catch (err) {
        fail(id, err);
      }
    },
    [analyzeDoc],
  );

  /** Re-run on the same document with forced column roles. */
  const reanalyze = useCallback(
    async (columnOverrides: Record<string, Record<number, ColumnRole>>) => {
      const doc = docRef.current;
      if (!doc) return;
      const id = ++runId.current;
      setState((s) => ({ ...s, phase: "analyzing", progress: 0.05, message: "Nuova analisi" }));
      try {
        await analyzeDoc(doc, id, columnOverrides);
      } catch (err) {
        fail(id, err);
      }
    },
    [analyzeDoc],
  );

  const reset = useCallback(() => {
    runId.current++;
    docRef.current = null;
    setState(INITIAL);
  }, []);

  return { state, analyzeFile, analyzeText, reanalyze, reset, doc: docRef };
}
