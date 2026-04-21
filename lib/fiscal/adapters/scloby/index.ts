// lib/fiscal/adapters/scloby/index.ts
// Scloby (Zucchetti) POS adapter.
// Endpoints & payload shapes: verify against https://api.scloby.com/v2/
// and the Scloby developer portal before production.
//
// Auth: API key stored in credentials.api_key; shop_id in config.shop_id.

import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  ApiKeyCredentials,
  Credentials,
  FetchWindow,
  FiscalIntegrationRow,
  NormalizedReceipt,
  ProviderConfig,
  ReceiptEvent,
} from "../../types.ts";
import type { PosAdapter } from "../types.ts";
import {
  sclobyReceiptSchema,
  sclobyWebhookBodySchema,
  type SclobyReceipt,
} from "./schemas.ts";

const SCLOBY_API_BASE = "https://api.scloby.com/v2";

function toCents(euro: number): number {
  return Math.round(euro * 100);
}

function statusFrom(
  event: ReceiptEvent["event_type"],
  receiptStatus: SclobyReceipt["status"],
): NormalizedReceipt["status"] {
  if (event === "receipt.voided" || receiptStatus === "voided") return "voided";
  if (event === "receipt.refunded" || receiptStatus === "refunded") return "refunded";
  return "issued";
}

async function fetchJSON(url: string, init?: RequestInit): Promise<unknown> {
  const r = await fetch(url, init);
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(
      `Scloby ${init?.method ?? "GET"} ${url} failed: ${r.status} ${body}`,
    );
  }
  return r.json();
}

export const sclobyAdapter: PosAdapter = {
  provider: "scloby",

  async *fetchReceipts(
    creds: Credentials,
    config: ProviderConfig,
    window: FetchWindow,
  ): AsyncIterable<ReceiptEvent> {
    if (creds.kind !== "api_key") {
      throw new Error("scloby.fetchReceipts requires api_key creds");
    }
    const apiKey = (creds as ApiKeyCredentials).api_key;
    const shop = config.shop_id ?? (creds as ApiKeyCredentials).shop_id;
    let page = 1;
    const pageSize = 100;
    for (;;) {
      const u = new URL(`${SCLOBY_API_BASE}/receipts`);
      u.searchParams.set("page", String(page));
      u.searchParams.set("per_page", String(pageSize));
      u.searchParams.set("from", window.since.toISOString());
      if (window.until) u.searchParams.set("to", window.until.toISOString());
      if (shop) u.searchParams.set("shop_id", String(shop));

      const res = (await fetchJSON(u.toString(), {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      })) as { data: unknown[]; has_more?: boolean };

      for (const raw of res.data ?? []) {
        const parsed = sclobyReceiptSchema.safeParse(raw);
        if (!parsed.success) continue;
        const eventType: ReceiptEvent["event_type"] =
          parsed.data.status === "voided"
            ? "receipt.voided"
            : parsed.data.status === "refunded"
              ? "receipt.refunded"
              : "receipt.created";
        yield {
          external_id: parsed.data.id,
          event_type: eventType,
          payload: parsed.data,
        };
      }
      if (!res.has_more || (res.data ?? []).length < pageSize) break;
      page += 1;
    }
  },

  verifyWebhook(headers, body, secret): boolean {
    const sig = headers["x-scloby-signature"] ?? headers["X-Scloby-Signature"];
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
    const json = JSON.parse(body);
    const parsed = sclobyWebhookBodySchema.safeParse(json);
    if (!parsed.success) return [];
    return [
      {
        external_id: parsed.data.receipt.id,
        event_type: parsed.data.event,
        payload: parsed.data.receipt,
      },
    ];
  },

  normalize(
    rawEvent: ReceiptEvent,
    _integration: Pick<FiscalIntegrationRow, "id" | "restaurant_id" | "config">,
  ): NormalizedReceipt | null {
    const parsed = sclobyReceiptSchema.safeParse(rawEvent.payload);
    if (!parsed.success) return null;
    const r = parsed.data;
    const items = r.items.map((it, idx) => {
      const unit = toCents(it.price);
      const discount = toCents(it.discount ?? 0);
      return {
        line_number: idx + 1,
        pos_item_id: it.id,
        name: it.name,
        category: it.department ?? null,
        quantity: it.qty,
        unit_price_cents: unit,
        subtotal_cents: Math.max(0, unit * it.qty - discount),
        vat_rate: it.vat ?? null,
        discount_cents: discount,
        is_voided: it.voided ?? false,
      };
    });
    return {
      external_id: r.id,
      issued_at: r.datetime,
      business_day: r.datetime.slice(0, 10),
      status: statusFrom(rawEvent.event_type, r.status),
      subtotal_cents: toCents(r.subtotal),
      vat_cents: toCents(r.vat_amount),
      total_cents: toCents(r.total),
      payment_method: r.payment ?? null,
      operator_name: r.cashier ?? null,
      table_ref: r.table ?? null,
      covers: r.covers ?? null,
      metadata: { number: r.number ?? null },
      items,
    };
  },
};
