// Smart import — shared types.
//
// The import pipeline has two layers:
//   1. Format layer (lib/import/formats/*): turns a file or pasted text into a
//      `SourceDoc` — rows of cells, independent of the original format.
//   2. Understanding layer (lib/import/understand/*, engine.ts): turns a
//      `SourceDoc` into an `ExtractionResult` (supplier info + products) with
//      per-field confidence and human-readable reasons.
//
// Everything in this folder except formats/pdf.ts, formats/ocr.ts and
// server/* is pure TypeScript usable in the browser, on the server and in
// `node --test` (relative imports with explicit `.ts` extensions).

import type { ImportCategory } from "./lexicon/categories.ts";

export type SourceKind = "csv" | "xlsx" | "pdf" | "image" | "text";

/**
 * How trustworthy the cell split of a sheet is.
 *  - "table": real spreadsheet cells (CSV / Excel)
 *  - "grid":  cells rebuilt from x/y positions (PDF text layer, OCR words)
 *  - "text":  one cell per line (pasted text, emails, chats)
 */
export type SheetLayout = "table" | "grid" | "text";

export type RawSheet = {
  name: string;
  layout: SheetLayout;
  rows: string[][];
};

export type SourceDoc = {
  kind: SourceKind;
  fileName?: string;
  sheets: RawSheet[];
  meta?: {
    pages?: number;
    /** Mean OCR word confidence 0–1, when the text came from OCR. */
    ocrConfidence?: number;
    /** Pages that had no text layer and went through OCR. */
    ocrPages?: number;
    /** Rows dropped by the format layer (never silent: surfaced as warning). */
    droppedRows?: number;
    /** Pages beyond the page limit that were not read (surfaced as warning). */
    skippedPages?: number;
  };
};

// ---------------------------------------------------------------------------
// Units and packs
// ---------------------------------------------------------------------------

/** Measurement base used to compare prices: per kg, per litre, per piece. */
export type MeasureBase = "kg" | "l" | "pz";

/** Containers a product can be sold in. */
export type ContainerUnit =
  | "cartone"
  | "cassa"
  | "confezione"
  | "sacco"
  | "busta"
  | "vaschetta"
  | "secchio"
  | "latta"
  | "bottiglia"
  | "fusto"
  | "vassoio"
  | "mazzo"
  | "pallet"
  | "rotolo";

/** The unit the price refers to. */
export type SaleUnit = MeasureBase | "g" | "hg" | "ml" | "cl" | ContainerUnit;

export type PackInfo = {
  container?: ContainerUnit;
  /** Pieces inside one sale unit (e.g. 6 for "6x1L", 8 for "125g x 8"). */
  pieces?: number;
  /** Size of one piece, normalized to kg / l. */
  pieceSize?: { value: number; base: "kg" | "l" };
  /** Total quantity of one sale unit in its base (kg, l or pz). */
  total?: { value: number; base: MeasureBase };
};

// ---------------------------------------------------------------------------
// Extraction output
// ---------------------------------------------------------------------------

export type FieldConfidence = {
  /** 0–1 */
  score: number;
  /** Short Italian explanation, shown in the review UI. */
  reason: string;
};

export type ExtractedProduct = {
  /** Stable id inside one extraction (row index based). */
  id: string;
  /** Original text the product was read from. */
  original: string;
  /** Key used by the import memory (normalized raw name). */
  sourceKey: string;
  /** Normalized product name (abbreviations expanded), without pack info. */
  name: string;
  /** Human pack descriptor, e.g. "cartone 6 × 1 l", "125 g". */
  format: string | null;
  code: string | null;
  brand: string | null;
  category: ImportCategory;
  /** Category/section heading found in the document above this product. */
  section: string | null;
  price: number | null;
  /** What `price` refers to. */
  priceUnit: SaleUnit;
  pack: PackInfo;
  /** Price per kg / l / pz when it can be computed. */
  unitPrice: { value: number; base: MeasureBase } | null;
  vatRate: number | null;
  minQty: { value: number; unit: SaleUnit | null } | null;
  /** Availability / seasonality note ("fino ad esaurimento", "da maggio"). */
  availability: string | null;
  /** false when the line says "esaurito", "non disponibile", … */
  available: boolean;
  origin: string | null;
  confidence: {
    overall: number;
    name: FieldConfidence;
    price: FieldConfidence;
    unit: FieldConfidence;
    category: FieldConfidence;
  };
  /** Things the user should look at, in Italian. Empty when all is clear. */
  issues: string[];
  /** True when a remembered correction was applied. */
  fromMemory: boolean;
  /** Other rows merged into this one (duplicates). */
  mergedCount: number;
};

export type SupplierInfo = {
  name: string | null;
  vatNumber: string | null;
  /** True when the P.IVA checksum is valid. */
  vatNumberValid: boolean;
  fiscalCode: string | null;
  emails: string[];
  pec: string | null;
  phones: string[];
  address: string | null;
  zip: string | null;
  city: string | null;
  province: string | null;
  /** ISO weekday numbers 1 (lun) … 7 (dom). */
  deliveryDays: number[];
  deliveryDaysText: string | null;
  minOrder: number | null;
  /** Free delivery threshold when stated ("consegna gratuita sopra 150€"). */
  freeDeliveryOver: number | null;
  orderCutoff: string | null;
  leadTimeDays: number | null;
  website: string | null;
  notes: string[];
  confidence: Partial<Record<SupplierField, FieldConfidence>>;
};

export type SupplierField =
  | "name"
  | "vatNumber"
  | "emails"
  | "phones"
  | "address"
  | "deliveryDays"
  | "minOrder"
  | "leadTimeDays";

export type ExtractionStats = {
  rowsRead: number;
  productLines: number;
  supplierLines: number;
  headerLines: number;
  noiseLines: number;
  sectionLines: number;
  duplicatesMerged: number;
  /** Products needing attention (overall confidence < REVIEW_THRESHOLD). */
  needsReview: number;
  /** Which strategy produced the products per sheet. */
  strategies: Array<{ sheet: string; strategy: "table" | "lines"; columns?: Partial<Record<string, ColumnRole>> }>;
};

export type ExtractionResult = {
  extractor: string;
  supplier: SupplierInfo;
  products: ExtractedProduct[];
  /** Document level messages (Italian). */
  warnings: string[];
  /** Prices declared as VAT-included / excluded at document level. */
  pricesIncludeVat: boolean | null;
  stats: ExtractionStats;
  /** Header signatures + roles used, so the memory can learn layouts. */
  layouts: Array<{ signature: string; roles: Record<number, ColumnRole> }>;
};

/** Below this overall confidence a product is highlighted for review. */
export const REVIEW_THRESHOLD = 0.7;

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export type ColumnRole =
  | "name"
  | "code"
  | "unit"
  | "pack"
  | "price"
  | "vat"
  | "brand"
  | "category"
  | "origin"
  | "minQty"
  | "availability"
  | "qty"
  | "ignore";

// ---------------------------------------------------------------------------
// Memory (learned per supplier / per restaurant)
// ---------------------------------------------------------------------------

export type ProductHint = {
  name?: string;
  priceUnit?: SaleUnit;
  category?: ImportCategory;
  /** User removed this line on a previous import: skip it. */
  ignore?: boolean;
};

export type ImportHints = {
  version: 1;
  /** sourceKey → correction */
  products: Record<string, ProductHint>;
  /** abbreviation token (folded, no trailing dot) → expansion */
  abbreviations: Record<string, string>;
  /** header signature → column roles by index */
  columnLayouts: Record<string, Record<number, ColumnRole>>;
  /** Last confirmed supplier details, used to fill gaps. */
  supplier?: Partial<Pick<SupplierInfo, "name" | "vatNumber" | "emails" | "phones" | "address" | "deliveryDays" | "minOrder" | "leadTimeDays">>;
};

export function emptyHints(): ImportHints {
  return { version: 1, products: {}, abbreviations: {}, columnLayouts: {} };
}

// ---------------------------------------------------------------------------
// Extractor strategy
// ---------------------------------------------------------------------------

export type ExtractionProgress = {
  stage: "reading" | "classifying" | "supplier" | "products" | "matching" | "done";
  /** 0–1 */
  progress: number;
  message: string;
};

export type KnownProduct = { name: string; category: ImportCategory };

export type ExtractionContext = {
  persona: "restaurant" | "supplier";
  /**
   * Resolves remembered hints once the supplier has been identified (the
   * restaurant side keys memory by supplier P.IVA / name; the supplier side
   * has a single memory and ignores the argument).
   */
  loadHints?: (supplier: SupplierInfo) => Promise<ImportHints | null> | ImportHints | null;
  /** Product names with a known category (platform catalog, past imports). */
  knownProducts?: KnownProduct[];
  /** Forced column roles per sheet name (user override from the review UI). */
  columnOverrides?: Record<string, Record<number, ColumnRole>>;
  onProgress?: (p: ExtractionProgress) => void;
};

/**
 * Pluggable extraction strategy. The app ships only the deterministic
 * `localExtractor` (lib/import/engine.ts); another implementation (e.g. one
 * backed by a model) can be added later behind the same interface.
 */
export interface Extractor {
  readonly id: string;
  extract(doc: SourceDoc, ctx: ExtractionContext): Promise<ExtractionResult>;
}
