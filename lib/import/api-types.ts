// Types shared by the analyze route, the commit actions and the import UI.

import type { ColumnRole, ExtractionProgress, ExtractionResult, SourceDoc } from "./types.ts";
import type { CatalogCandidate } from "./match/supplier-match.ts";

export type ImportPersona = "restaurant" | "supplier";

export type AnalyzeRequest = {
  persona: ImportPersona;
  doc: SourceDoc;
  /** Restaurant: update this catalog (entry point "Importa" on a catalog page). */
  targetCatalogId?: string | null;
  /** User-forced column roles per sheet name (review screen → "Colonne"). */
  columnOverrides?: Record<string, Record<number, ColumnRole>>;
};

export type CatalogSnapshot = {
  id: string;
  supplier_name: string;
  delivery_days: number | null;
  min_order_amount: number | null;
  notes: string | null;
  items: Array<{ id: string; name: string; unit: string; price: number }>;
};

export type PlatformSupplierMatch = {
  id: string;
  company_name: string;
  city: string | null;
  reason: string;
};

export type RestaurantContextPayload = {
  persona: "restaurant";
  /** Existing catalogs that look like the same supplier (best first). */
  candidates: Array<CatalogCandidate & { catalog: CatalogSnapshot }>;
  /** Catalog explicitly targeted by the entry point. */
  target: CatalogSnapshot | null;
  /** Every catalog of the restaurant, to let the user pick another one. */
  catalogs: Array<{ id: string; supplier_name: string; items: number }>;
  platformSupplier: PlatformSupplierMatch | null;
  platformEnabled: boolean;
  canManage: boolean;
};

export type SupplierProductSnapshot = {
  id: string;
  name: string;
  unit: string;
  price: number;
  is_available: boolean;
  sku: string | null;
  brand: string | null;
  category_id: string;
};

export type SupplierContextPayload = {
  persona: "supplier";
  products: SupplierProductSnapshot[];
  categories: Array<{ id: string; name: string; slug: string }>;
  priceLists: Array<{ id: string; name: string; is_default: boolean }>;
  canEditPricing: boolean;
};

export type AnalyzeContextPayload = RestaurantContextPayload | SupplierContextPayload;

export type AnalyzeEvent =
  | ({ type: "progress" } & ExtractionProgress)
  | { type: "result"; result: ExtractionResult; context: AnalyzeContextPayload; memoryUsed: boolean }
  | { type: "error"; message: string };

/** Hard limits, shared by client (early feedback) and server (enforcement). */
export const IMPORT_LIMITS = {
  /** JSON body of the analyze request (Vercel functions accept ~4.5 MB). */
  maxBodyBytes: 4 * 1024 * 1024,
  maxSheets: 40,
  maxRows: 20_000,
  maxCellsPerRow: 80,
  maxCellChars: 4_000,
  maxItemsPerCommit: 5_000,
} as const;
