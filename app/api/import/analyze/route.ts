// POST /api/import/analyze — smart import analysis.
//
// The browser turns the dropped file / pasted text into a SourceDoc (rows of
// cells; PDF text and OCR happen client-side). This route authorizes the
// user, runs the local recognition engine with the user's import memory and
// returns, as NDJSON, progress events followed by the result and the data the
// review screen compares against (existing catalogs / products).
//
// No external AI service is involved; the Extractor strategy is pluggable
// (lib/import/types.ts) if one is ever added.

import { z } from "zod";
import { applyLimit, importLimiter } from "@/lib/utils/rate-limit";
import { localExtractor } from "@/lib/import/engine";
import type { AnalyzeEvent, AnalyzeRequest, RestaurantContextPayload } from "@/lib/import/api-types";
import { IMPORT_LIMITS } from "@/lib/import/api-types";
import type { ColumnRole, ExtractionResult, Extractor, ImportHints, SupplierInfo } from "@/lib/import/types";
import { supplierMemoryKeys } from "@/lib/import/memory";
import { matchSupplierToCatalogs } from "@/lib/import/match/supplier-match";
import {
  findPlatformSupplier,
  loadHints,
  loadKnownProducts,
  loadRestaurantCatalogs,
  loadSupplierContext,
  resolveImportActor,
  type ImportActor,
} from "@/lib/import/server/context";
import { SUPPLIER_PLATFORM_ENABLED } from "@/lib/utils/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Parsing is CPU-bound and fast (≈1 s for 5 000 rows); 60 s covers the
// slowest documents and stays within the Vercel Hobby/Pro defaults.
export const maxDuration = 60;

const ROLE = z.enum(["name", "code", "unit", "pack", "price", "vat", "brand", "category", "origin", "minQty", "availability", "qty", "ignore"]);

const DocSchema = z.object({
  kind: z.enum(["csv", "xlsx", "pdf", "image", "text"]),
  fileName: z.string().max(300).optional(),
  sheets: z
    .array(
      z.object({
        name: z.string().max(200),
        layout: z.enum(["table", "grid", "text"]),
        rows: z
          .array(z.array(z.string().max(IMPORT_LIMITS.maxCellChars)).max(IMPORT_LIMITS.maxCellsPerRow))
          .max(IMPORT_LIMITS.maxRows),
      }),
    )
    .min(1)
    .max(IMPORT_LIMITS.maxSheets),
  meta: z
    .object({
      pages: z.number().int().nonnegative().optional(),
      ocrConfidence: z.number().min(0).max(1).optional(),
      ocrPages: z.number().int().nonnegative().optional(),
      droppedRows: z.number().int().nonnegative().optional(),
      skippedPages: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

const BodySchema = z.object({
  persona: z.enum(["restaurant", "supplier"]),
  doc: DocSchema,
  targetCatalogId: z.string().uuid().nullish(),
  columnOverrides: z.record(z.string(), z.record(z.string(), ROLE)).optional(),
});

/**
 * Keep big results well under the platform response limits: for long lists
 * drop the explanation of fields that are certain and shorten the original
 * text (the review shows reasons only where attention is needed).
 */
function compactResult(result: ExtractionResult): ExtractionResult {
  if (result.products.length < 800) return result;
  return {
    ...result,
    products: result.products.map((p) => {
      const c = p.confidence;
      const slim = (f: typeof c.name) => (f.score >= 0.85 ? { score: f.score, reason: "" } : f);
      return {
        ...p,
        original: p.original.length > 160 ? `${p.original.slice(0, 157)}…` : p.original,
        confidence: { overall: c.overall, name: slim(c.name), price: slim(c.price), unit: c.unit, category: slim(c.category) },
      };
    }),
  };
}

/** Strategy selection: only the local, deterministic extractor exists. */
function getExtractor(): Extractor {
  return localExtractor;
}

function json(status: number, error: string) {
  return Response.json({ error }, { status });
}

export async function POST(req: Request) {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > IMPORT_LIMITS.maxBodyBytes) {
    return json(413, "Documento troppo grande da analizzare in una volta: dividi il file (max ~4 MB di testo).");
  }

  let body: AnalyzeRequest;
  try {
    const raw = await req.text();
    if (raw.length > IMPORT_LIMITS.maxBodyBytes) {
      return json(413, "Documento troppo grande da analizzare in una volta: dividi il file (max ~4 MB di testo).");
    }
    const parsed = BodySchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return json(400, "Documento non valido o troppo grande (max 20.000 righe).");
    body = parsed.data as AnalyzeRequest;
  } catch {
    return json(400, "Richiesta non valida.");
  }
  const totalRows = body.doc.sheets.reduce((n, s) => n + s.rows.length, 0);
  if (totalRows > IMPORT_LIMITS.maxRows) {
    return json(413, `Troppe righe (${totalRows.toLocaleString("it-IT")}): il massimo è ${IMPORT_LIMITS.maxRows.toLocaleString("it-IT")} per import.`);
  }

  const auth = await resolveImportActor(body.persona);
  if (!auth.ok) return json(auth.status, auth.error);
  const actor = auth.actor;

  const limit = await applyLimit(importLimiter, `import:${actor.userId}`);
  if (!limit.allowed) {
    return json(429, "Hai analizzato molti documenti di fila: riprova tra qualche minuto.");
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: AnalyzeEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
      try {
        send({ type: "progress", stage: "reading", progress: 0.01, message: "Documento ricevuto" });
        await analyze(actor, body, send);
      } catch (err) {
        console.error("[import/analyze] failed", err);
        send({ type: "error", message: "Non siamo riusciti ad analizzare il documento. Riprova o usa l’import avanzato." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}

async function analyze(actor: ImportActor, body: AnalyzeRequest, send: (e: AnalyzeEvent) => void) {
  const extractor = getExtractor();
  let memoryUsed = false;

  if (actor.kind === "restaurant") {
    const [catalogs, knownProducts] = await Promise.all([loadRestaurantCatalogs(actor.scopeIds), loadKnownProducts(actor)]);
    const target = body.targetCatalogId ? catalogs.find((c) => c.id === body.targetCatalogId) ?? null : null;

    const result = await extractor.extract(body.doc, {
      persona: "restaurant",
      knownProducts,
      columnOverrides: body.columnOverrides as Record<string, Record<number, ColumnRole>> | undefined,
      onProgress: (p) => send({ type: "progress", ...p }),
      loadHints: async (supplier: SupplierInfo): Promise<ImportHints | null> => {
        const best = matchSupplierToCatalogs(supplier, catalogs)[0];
        const catalogId = target?.id ?? (best && best.score >= 0.9 ? best.catalogId : null);
        const keys = supplierMemoryKeys(supplier, catalogId).reverse(); // most specific last = wins
        const h = await loadHints(actor, keys);
        memoryUsed = h !== null;
        return h;
      },
    });

    const candidates = matchSupplierToCatalogs(result.supplier, catalogs)
      .map((c) => ({ ...c, catalog: catalogs.find((x) => x.id === c.catalogId)! }))
      .filter((c) => c.catalog);
    const platformSupplier = await findPlatformSupplier(result.supplier);

    const context: RestaurantContextPayload = {
      persona: "restaurant",
      candidates,
      target,
      catalogs: catalogs.map((c) => ({ id: c.id, supplier_name: c.supplier_name, items: c.items.length })),
      platformSupplier,
      platformEnabled: SUPPLIER_PLATFORM_ENABLED,
      canManage: actor.canManage,
    };
    send({ type: "result", result: compactResult(result), context, memoryUsed });
    return;
  }

  const [supplierCtx, knownProducts] = await Promise.all([loadSupplierContext(actor), loadKnownProducts(actor)]);
  const result = await extractor.extract(body.doc, {
    persona: "supplier",
    knownProducts,
    columnOverrides: body.columnOverrides as Record<string, Record<number, ColumnRole>> | undefined,
    onProgress: (p) => send({ type: "progress", ...p }),
    loadHints: async () => {
      const h = await loadHints(actor, ["self"]);
      memoryUsed = h !== null;
      return h;
    },
  });
  send({ type: "result", result: compactResult(result), context: supplierCtx, memoryUsed });
}
