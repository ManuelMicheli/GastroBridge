// Browser-only OCR with tesseract.js (Italian + English).
//
// The worker script, the WASM core and the language data are fetched from
// cdn.jsdelivr.net, pinned to the installed versions, and allowed narrowly in
// the CSP (next.config.ts). Language data is cached by tesseract.js in
// IndexedDB after the first use. Nothing is loaded until a photo is imported.

import { reconstructRows, type PositionedText } from "./layout.ts";

export const TESSERACT_VERSION = "7.0.0";
export const TESSERACT_CORE_VERSION = "7.0.0";
export const OCR_WORKER_PATH = `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/worker.min.js`;
export const OCR_CORE_PATH = `https://cdn.jsdelivr.net/npm/tesseract.js-core@${TESSERACT_CORE_VERSION}`;
// Language data defaults to https://cdn.jsdelivr.net/npm/@tesseract.js-data/<lang>/4.0.0_best_int

export type OcrResult = { rows: string[][]; confidence: number };
export type OcrProgress = (progress: number, message: string) => void;

type TesseractWorker = Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>;

let workerPromise: Promise<TesseractWorker> | null = null;
let progressSink: OcrProgress | null = null;

const STATUS_IT: Record<string, string> = {
  "loading tesseract core": "Caricamento del motore OCR",
  "initializing tesseract": "Avvio OCR",
  "loading language traineddata": "Download dizionario italiano (solo la prima volta)",
  "loading language traineddata (from cache)": "Caricamento dizionario",
  "initializing api": "Preparazione",
  "recognizing text": "Lettura del testo nella foto",
};

async function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, OEM } = await import("tesseract.js");
      const worker = await createWorker(["ita", "eng"], OEM.LSTM_ONLY, {
        workerPath: OCR_WORKER_PATH,
        corePath: OCR_CORE_PATH,
        logger: (m) => {
          progressSink?.(m.progress ?? 0, STATUS_IT[m.status] ?? m.status);
        },
      });
      await worker.setParameters({ preserve_interword_spaces: "1" });
      return worker;
    })().catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

/** Release the OCR worker (call when the import flow closes). */
export async function terminateOcr(): Promise<void> {
  const p = workerPromise;
  workerPromise = null;
  if (p) {
    try {
      (await p).terminate();
    } catch {
      /* ignore */
    }
  }
}

/** Downscale huge phone photos (speed) and upscale tiny images (accuracy). */
async function prepareImage(source: Blob | HTMLCanvasElement): Promise<HTMLCanvasElement> {
  if (typeof HTMLCanvasElement !== "undefined" && source instanceof HTMLCanvasElement) return source;
  const bitmap = await createImageBitmap(source as Blob);
  const longSide = Math.max(bitmap.width, bitmap.height);
  const scale = longSide > 2600 ? 2600 / longSide : longSide < 1000 ? 2 : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non disponibile");
  // grayscale + slight contrast helps on paper photos
  ctx.filter = "grayscale(1) contrast(1.15)";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas;
}

export async function ocrImage(source: Blob | HTMLCanvasElement, onProgress?: OcrProgress): Promise<OcrResult> {
  progressSink = onProgress ?? null;
  try {
    const worker = await getWorker();
    const canvas = await prepareImage(source);
    const { data } = await worker.recognize(canvas, {}, { blocks: true, text: true });
    const items: PositionedText[] = [];
    let confSum = 0;
    let n = 0;
    for (const block of data.blocks ?? []) {
      for (const para of block.paragraphs) {
        for (const line of para.lines) {
          for (const w of line.words) {
            const t = w.text.trim();
            if (!t) continue;
            items.push({ text: t, x: w.bbox.x0, y: w.bbox.y0, w: w.bbox.x1 - w.bbox.x0, h: Math.max(1, w.bbox.y1 - w.bbox.y0) });
            confSum += w.confidence;
            n++;
          }
        }
      }
    }
    const rows = items.length > 0 ? reconstructRows(items, canvas.width) : (data.text ?? "").split("\n").map((l) => [l]);
    return { rows, confidence: n ? confSum / n / 100 : (data.confidence ?? 0) / 100 };
  } finally {
    progressSink = null;
  }
}
