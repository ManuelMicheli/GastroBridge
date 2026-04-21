// lib/fiscal/adapters/mock/index.ts
// In-memory adapter for tests + staging. Not exposed as a FiscalProvider
// in the DB enum — used only from test code and dev tooling.
import type {
  Credentials,
  FetchWindow,
  FiscalIntegrationRow,
  NormalizedReceipt,
  ProviderConfig,
  ReceiptEvent,
} from "../../types.ts";
import type { PosAdapter } from "../types.ts";
import { mockReceiptEvents } from "./fixtures.ts";

type MockPayload = {
  id: string;
  ts: string;
  items: Array<{
    id: string;
    name: string;
    qty: number;
    unit_cents: number;
    vat: number;
  }>;
  payment: string;
  covers?: number;
  operator?: string;
};

export const mockAdapter: PosAdapter = {
  provider: "generic_webhook",
  async *fetchReceipts(
    _creds: Credentials,
    _config: ProviderConfig,
    _window: FetchWindow,
  ): AsyncIterable<ReceiptEvent> {
    for (const ev of mockReceiptEvents) {
      yield ev;
    }
  },
  normalize(
    rawEvent: ReceiptEvent,
    _integration: Pick<FiscalIntegrationRow, "id" | "restaurant_id" | "config">,
  ): NormalizedReceipt | null {
    const payload = rawEvent.payload as MockPayload;
    const items = payload.items.map((it, idx) => ({
      line_number: idx + 1,
      pos_item_id: it.id,
      name: it.name,
      category: null,
      quantity: it.qty,
      unit_price_cents: Math.round(it.unit_cents),
      subtotal_cents: Math.round(it.unit_cents * it.qty),
      vat_rate: it.vat,
      discount_cents: 0,
      is_voided: false,
    }));
    const subtotal = items.reduce((s, i) => s + i.subtotal_cents, 0);
    const vat = Math.round(subtotal * 0.1);
    return {
      external_id: payload.id,
      issued_at: payload.ts,
      business_day: payload.ts.slice(0, 10),
      status: rawEvent.event_type === "receipt.voided" ? "voided" : "issued",
      subtotal_cents: subtotal,
      vat_cents: vat,
      total_cents: subtotal + vat,
      payment_method: payload.payment ?? null,
      operator_name: payload.operator ?? null,
      table_ref: null,
      covers: payload.covers ?? null,
      metadata: {},
      items,
    };
  },
};
