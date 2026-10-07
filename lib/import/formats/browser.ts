// Browser entry point of the format layer: File / pasted text → SourceDoc.
// Heavy libraries (exceljs, papaparse, pdfjs-dist, tesseract.js) are loaded
// on demand, only for the format actually dropped.

import type { SourceDoc } from "../types.ts";
import { csvToSourceDoc, decodeText, textToSourceDoc, xlsxToSourceDoc } from "./spreadsheet.ts";

export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
export const MAX_TEXT_CHARS = 400_000;

export type FormatProgress = (progress: number, message: string) => void;

export class ImportFormatError extends Error {}

export type DetectedFormat = "csv" | "xlsx" | "xls" | "pdf" | "image" | "text" | "heic" | "unknown";

export function detectFormat(file: { name: string; type: string }): DetectedFormat {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  const type = file.type.toLowerCase();
  if (ext === "csv" || ext === "tsv" || type === "text/csv") return "csv";
  if (ext === "xlsx" || ext === "xlsm" || type.includes("spreadsheetml")) return "xlsx";
  if (ext === "xls" || type === "application/vnd.ms-excel") return "xls";
  if (ext === "pdf" || type === "application/pdf") return "pdf";
  if (ext === "heic" || ext === "heif" || type.includes("heic") || type.includes("heif")) return "heic";
  if (type.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "bmp", "gif", "tif", "tiff"].includes(ext)) return "image";
  if (["txt", "eml", "text", "md"].includes(ext) || type.startsWith("text/")) return "text";
  return "unknown";
}

export const ACCEPT_ATTR =
  ".csv,.tsv,.xlsx,.xlsm,.pdf,.txt,.eml,.jpg,.jpeg,.png,.webp,.heic,.heif,image/*,application/pdf,text/plain,text/csv";

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!pdfjs.GlobalWorkerOptions.workerPort) {
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(
      new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url),
      { type: "module" },
    );
  }
  return pdfjs;
}

export async function readFileAsSourceDoc(file: File, onProgress: FormatProgress = () => {}): Promise<SourceDoc> {
  const format = detectFormat(file);
  if (file.size === 0) throw new ImportFormatError("Il file è vuoto.");

  switch (format) {
    case "csv": {
      if (file.size > MAX_FILE_BYTES) throw new ImportFormatError("File troppo grande (max 15 MB).");
      onProgress(0.2, "Lettura CSV");
      return csvToSourceDoc(decodeText(await file.arrayBuffer()), file.name);
    }
    case "xlsx": {
      if (file.size > MAX_FILE_BYTES) throw new ImportFormatError("File troppo grande (max 15 MB).");
      onProgress(0.2, "Lettura Excel");
      return xlsxToSourceDoc(await file.arrayBuffer(), file.name);
    }
    case "xls":
      throw new ImportFormatError("Il vecchio formato .xls non è supportato: aprilo e salvalo come .xlsx o CSV, oppure copia e incolla le righe qui.");
    case "pdf": {
      if (file.size > MAX_FILE_BYTES) throw new ImportFormatError("PDF troppo grande (max 15 MB).");
      onProgress(0.05, "Apertura PDF");
      const [{ pdfToSourceDoc }, pdfjs] = await Promise.all([import("./pdf.ts"), loadPdfJs()]);
      return pdfToSourceDoc(await file.arrayBuffer(), {
        pdfjs,
        fileName: file.name,
        onProgress: (done, total, message) => onProgress(0.05 + 0.9 * (done / Math.max(1, total)), message),
        ocrPage: async (page) => {
          // scanned page → render to canvas → OCR
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          await page.render({ canvas, viewport }).promise;
          const { ocrImage } = await import("./ocr.ts");
          return ocrImage(canvas, (p, m) => onProgress(0.1 + 0.8 * p, `Pagina scansionata: ${m}`));
        },
      });
    }
    case "heic":
      throw new ImportFormatError("Le foto HEIC dell’iPhone non sono leggibili dal browser: condividi la foto come JPG (o fai uno screenshot) e riprova.");
    case "image": {
      if (file.size > MAX_IMAGE_BYTES) throw new ImportFormatError("Foto troppo grande (max 12 MB).");
      onProgress(0.02, "Preparazione OCR");
      const { ocrImage } = await import("./ocr.ts");
      const res = await ocrImage(file, (p, m) => onProgress(0.05 + 0.9 * p, m));
      return {
        kind: "image",
        fileName: file.name,
        sheets: [{ name: file.name.replace(/\.[a-z0-9]+$/i, "") || "Foto", layout: "grid", rows: res.rows }],
        meta: { ocrConfidence: res.confidence, ocrPages: 1 },
      };
    }
    case "text": {
      const text = decodeText(await file.arrayBuffer());
      if (text.length > MAX_TEXT_CHARS) throw new ImportFormatError("Testo troppo lungo (max 400.000 caratteri).");
      return textToSourceDoc(text, file.name);
    }
    default:
      throw new ImportFormatError("Formato non riconosciuto. Usa PDF, Excel (.xlsx), CSV, una foto (JPG/PNG) o incolla il testo.");
  }
}

export function pastedTextAsSourceDoc(text: string): SourceDoc {
  if (text.length > MAX_TEXT_CHARS) throw new ImportFormatError("Testo troppo lungo (max 400.000 caratteri).");
  if (!text.trim()) throw new ImportFormatError("Incolla del testo da analizzare.");
  return textToSourceDoc(text);
}
