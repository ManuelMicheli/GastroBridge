// lib/fiscal/adapters/csv-upload/index.ts
// Adapter for manual CSV import.
// The CSV parser (lib/fiscal/csv.ts) produces NormalizedReceipt payloads
// and inserts them as fiscal_raw_events with provider='csv_upload'.
// This adapter's normalize() is a pass-through.

import type {
  Credentials,
  FetchWindow,
  FiscalIntegrationRow,
  NormalizedReceipt,
  ProviderConfig,
  ReceiptEvent,
} from "../../types.ts";
import type { PosAdapter } from "../types.ts";

export const csvUploadAdapter: PosAdapter = {
  provider: "csv_upload",

  async *fetchReceipts(
    _creds: Credentials,
    _config: ProviderConfig,
    _window: FetchWindow,
  ): AsyncIterable<ReceiptEvent> {
    // Push-only: rows arrive via the CSV import server action.
    return;
  },

  normalize(
    rawEvent: ReceiptEvent,
    _integration: Pick<FiscalIntegrationRow, "id" | "restaurant_id" | "config">,
  ): NormalizedReceipt | null {
    // Payload is already a NormalizedReceipt (serialized by the CSV parser).
    const p = rawEvent.payload as NormalizedReceipt | null;
    if (!p || typeof p !== "object") return null;
    if (!p.external_id || !p.items || !Array.isArray(p.items)) return null;
    return p;
  },
};
