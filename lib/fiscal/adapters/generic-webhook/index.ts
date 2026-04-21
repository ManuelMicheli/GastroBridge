// lib/fiscal/adapters/generic-webhook/index.ts
// Adapter for POS that push events to our endpoint and sign the body
// with HMAC-SHA256 using the shared secret stored in
// fiscal_integrations.webhook_secret.
//
// Expected body (one of):
// {
//   "external_id": "...",
//   "event_type": "receipt.created" | "receipt.voided" | "receipt.refunded",
//   "issued_at": "2026-04-21T12:15:00+02:00",
//   "subtotal_cents": 3800,
//   "vat_cents": 380,
//   "total_cents": 4180,
//   "payment_method": "card",
//   "covers": 2,
//   "items": [ { "line_number": 1, "name": "...", "quantity": 1,
//                "unit_price_cents": 2200, "subtotal_cents": 2200,
//                "vat_rate": 10 } ]
// }

import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  Credentials,
  FetchWindow,
  FiscalIntegrationRow,
  NormalizedReceipt,
  ProviderConfig,
  ReceiptEvent,
} from "../../types.ts";
import type { PosAdapter } from "../types.ts";

type GenericWebhookBody = {
  external_id: string;
  event_type: ReceiptEvent["event_type"];
  issued_at: string;
  business_day?: string;
  subtotal_cents: number;
  vat_cents: number;
  total_cents: number;
  payment_method?: string | null;
  operator_name?: string | null;
  table_ref?: string | null;
  covers?: number | null;
  metadata?: Record<string, unknown>;
  items: Array<{
    line_number: number;
    pos_item_id?: string | null;
    name: string;
    category?: string | null;
    quantity: number;
    unit_price_cents: number;
    subtotal_cents: number;
    vat_rate?: number | null;
    discount_cents?: number;
    is_voided?: boolean;
  }>;
};

export const genericWebhookAdapter: PosAdapter = {
  provider: "generic_webhook",

  verifyWebhook(headers, body, secret): boolean {
    const sig = headers["x-gb-signature"] ?? headers["X-GB-Signature"];
    if (!sig || !secret) return false;
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    let a: Buffer;
    let b: Buffer;
    try {
      a = Buffer.from(expected, "hex");
      b = Buffer.from(String(sig), "hex");
    } catch {
      return false;
    }
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  },

  parseWebhook(body: string): ReceiptEvent[] {
    const parsed = JSON.parse(body) as GenericWebhookBody;
    return [
      {
        external_id: parsed.external_id,
        event_type: parsed.event_type,
        payload: parsed,
      },
    ];
  },

  async *fetchReceipts(
    _creds: Credentials,
    _config: ProviderConfig,
    _window: FetchWindow,
  ): AsyncIterable<ReceiptEvent> {
    // Generic webhook is push-only — no pull.
    return;
  },

  normalize(
    rawEvent: ReceiptEvent,
    _integration: Pick<FiscalIntegrationRow, "id" | "restaurant_id" | "config">,
  ): NormalizedReceipt | null {
    const p = rawEvent.payload as GenericWebhookBody;
    return {
      external_id: p.external_id,
      issued_at: p.issued_at,
      business_day: p.business_day ?? p.issued_at.slice(0, 10),
      status:
        rawEvent.event_type === "receipt.voided"
          ? "voided"
          : rawEvent.event_type === "receipt.refunded"
            ? "refunded"
            : "issued",
      subtotal_cents: p.subtotal_cents,
      vat_cents: p.vat_cents,
      total_cents: p.total_cents,
      payment_method: p.payment_method ?? null,
      operator_name: p.operator_name ?? null,
      table_ref: p.table_ref ?? null,
      covers: p.covers ?? null,
      metadata: p.metadata ?? {},
      items: p.items.map((it) => ({
        line_number: it.line_number,
        pos_item_id: it.pos_item_id ?? null,
        name: it.name,
        category: it.category ?? null,
        quantity: it.quantity,
        unit_price_cents: it.unit_price_cents,
        subtotal_cents: it.subtotal_cents,
        vat_rate: it.vat_rate ?? null,
        discount_cents: it.discount_cents ?? 0,
        is_voided: it.is_voided ?? false,
      })),
    };
  },
};
