// PDF → SourceDoc via pdfjs-dist (text layer + layout reconstruction).
// The pdfjs module is injected so the same code runs in the browser (with a
// web worker) and in Node tests (legacy build, fake worker).

import type { SourceDoc } from "../types.ts";
import { reconstructRows, type PositionedText } from "./layout.ts";

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type PdfPage = Awaited<ReturnType<Awaited<ReturnType<PdfJsModule["getDocument"]>["promise"]>["getPage"]>>;

export type PdfOptions = {
  pdfjs: PdfJsModule;
  fileName?: string;
  maxPages?: number;
  onProgress?: (done: number, total: number, message: string) => void;
  /** OCR fallback for pages without a text layer (scans). Browser only. */
  ocrPage?: (page: PdfPage) => Promise<{ rows: string[][]; confidence: number } | null>;
};

export const MAX_PDF_PAGES = 60;

export async function pdfPageItems(page: PdfPage): Promise<{ items: PositionedText[]; width: number; chars: number }> {
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items: PositionedText[] = [];
  let chars = 0;
  for (const raw of content.items) {
    if (!("str" in raw)) continue;
    const it = raw as { str: string; transform: number[]; width: number; height: number };
    if (!it.str) continue;
    const [, , , d = 0, e = 0, f = 0] = it.transform;
    const h = Math.abs(it.height || d) || 8;
    chars += it.str.trim().length;
    items.push({ text: it.str, x: e, y: viewport.height - f - h, w: it.width, h });
  }
  return { items, width: viewport.width, chars };
}

export async function pdfToSourceDoc(data: ArrayBuffer | Uint8Array, opts: PdfOptions): Promise<SourceDoc> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const task = opts.pdfjs.getDocument({ data: bytes, useSystemFonts: false, disableFontFace: true, verbosity: 0 });
  const pdf = await task.promise;
  const maxPages = Math.min(pdf.numPages, opts.maxPages ?? MAX_PDF_PAGES);
  const rows: string[][] = [];
  let ocrPages = 0;
  let ocrConfSum = 0;
  try {
    for (let p = 1; p <= maxPages; p++) {
      opts.onProgress?.(p - 1, maxPages, `Lettura pagina ${p} di ${maxPages}`);
      const page = await pdf.getPage(p);
      const { items, width, chars } = await pdfPageItems(page);
      if (chars < 15 && opts.ocrPage) {
        // scanned page: no text layer
        const res = await opts.ocrPage(page);
        if (res) {
          rows.push(...res.rows);
          ocrPages++;
          ocrConfSum += res.confidence;
        }
      } else {
        rows.push(...reconstructRows(items, width));
      }
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  opts.onProgress?.(maxPages, maxPages, "PDF letto");
  return {
    kind: "pdf",
    fileName: opts.fileName,
    sheets: [{ name: opts.fileName?.replace(/\.pdf$/i, "") || "PDF", layout: "grid", rows }],
    meta: {
      pages: pdf.numPages,
      ...(ocrPages ? { ocrPages, ocrConfidence: ocrConfSum / ocrPages } : {}),
      ...(pdf.numPages > maxPages ? { skippedPages: pdf.numPages - maxPages } : {}),
    },
  };
}
