// lib/fiscal/adapters/cassa-in-cloud/index.ts
// Cassa in Cloud (TeamSystem) POS adapter.
// Endpoints & payload shapes: verify against https://api-it.cassanova.com
// or the Cassa in Cloud developer portal before production.
//
// Auth: API key issued from the Cassa in Cloud console. Stored in
// credentials.api_key; shop_id stored in config.shop_id.

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
  cicReceiptSchema,
  cicWebhookBodySchema,
  type CicReceipt,
} from "./schemas.ts";

const CIC_API_BASE = "https://api.cassanova.com/v1";

function toCents(euro: number): number {
  return Math.round(euro * 100);
}

function statusFrom(
  event: ReceiptEvent["event_type"],
  receiptStatus: CicReceipt["status"],
): NormalizedReceipt["status"] {
  if (event === "receipt.voided" || receiptStatus === "CANCELLED") return "voided";
  if (event === "receipt.refunded" || receiptStatus === "REFUNDED") return "refunded";
  return "issued";
}

async function fetchJSON(url: string, init?: RequestInit): Promise<unknown> {
  const r = await fetch(url, init);
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(
      `Cassa in Cloud ${init?.method ?? "GET"} ${url} failed: ${r.status} ${body}`,
    );
  }
  return r.json();
}

export const cassaInCloudAdapter: PosAdapter = {
  provider: "cassa_in_cloud",

  async *fetchReceipts(
    creds: Credentials,
    config: ProviderConfig,
    window: FetchWindow,
  ): AsyncIterable<ReceiptEvent> {
    if (creds.kind !== "api_key") {
      throw new Error("cassa_in_cloud.fetchReceipts requires api_key creds");
    }
    const apiKey = (creds as ApiKeyCredentials).api_key;
    const shopId =
      config.shop_id ??
      (creds as ApiKeyCredentials).shop_id ??
      undefined;
    let page = 1;
    const pageSize = 100;
    for (;;) {
      const u = new URL(`${CIC_API_BASE}/receipts`);
      u.searchParams.set("page", String(page));
      u.searchParams.set("pageSize", String(pageSize));
      u.searchParams.set("from", window.since.toISOString());
      if (window.until) u.searchParams.set("to", window.until.toISOString());
      if (shopId) u.searchParams.set("shopId", String(shopId));

      const res = (await fetchJSON(u.toString(), {
        headers: {
          apikey: apiKey,
          Accept: "application/json",
        },
      })) as { data: unknown[]; hasMore?: boolean };

      for (const raw of res.data ?? []) {
        const parsed = cicReceiptSchema.safeParse(raw);
        if (!parsed.success) continue;
        const eventType: ReceiptEvent["event_type"] =
          parsed.data.status === "CANCELLED"
            ? "receipt.voided"
            : parsed.data.status === "REFUNDED"
              ? "receipt.refunded"
              : "receipt.created";
        yield {
          external_id: parsed.data.id,
          event_type: eventType,
          payload: parsed.data,
        };
      }
      if (!res.hasMore || (res.data ?? []).length < pageSize) break;
      page += 1;
    }
  },

  verifyWebhook(headers, body, secret): boolean {
    const sig = headers["x-cic-signature"] ?? headers["X-CIC-Signature"];
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
    const parsed = cicWebhookBodySchema.safeParse(json);
    if (!parsed.success) return [];
    const eventType: ReceiptEvent["event_type"] =
      parsed.data.eventType === "receipt.cancelled"
        ? "receipt.voided"
        : parsed.data.eventType === "receipt.refunded"
          ? "receipt.refunded"
          : "receipt.created";
    return [
      {
        external_id: parsed.data.data.id,
        event_type: eventType,
        payload: parsed.data.data,
      },
    ];
  },

  normalize(
    rawEvent: ReceiptEvent,
    _integration: Pick<FiscalIntegrationRow, "id" | "restaurant_id" | "config">,
  ): NormalizedReceipt | null {
    const parsed = cicReceiptSchema.safeParse(rawEvent.payload);
    if (!parsed.success) return null;
    const r = parsed.data;
    const items = r.items.map((it, idx) => {
      const unit = toCents(it.price);
      const discount = toCents(it.discountAmount ?? 0);
      return {
        line_number: idx + 1,
        pos_item_id: it.id,
        name: it.description,
        category: it.departmentName ?? null,
        quantity: it.quantity,
        unit_price_cents: unit,
        subtotal_cents: Math.max(0, unit * it.quantity - discount),
        vat_rate: it.vatRate ?? null,
        discount_cents: discount,
        is_voided: it.voided ?? false,
      };
    });
    return {
      external_id: r.id,
      issued_at: r.date,
      business_day: r.date.slice(0, 10),
      status: statusFrom(rawEvent.event_type, r.status),
      subtotal_cents: toCents(r.subtotal),
      vat_cents: toCents(r.vatTotal),
      total_cents: toCents(r.total),
      payment_method: r.paymentType ?? null,
      operator_name: r.operatorName ?? null,
      table_ref: r.tableName ?? null,
      covers: r.covers ?? null,
      metadata: { document_number: r.documentNumber ?? null },
      items,
    };
  },
};
