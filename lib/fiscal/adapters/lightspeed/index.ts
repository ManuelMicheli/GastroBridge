// lib/fiscal/adapters/lightspeed/index.ts
// Lightspeed Restaurant (K-Series) POS adapter.
// Endpoints & payload shapes: verify against
// https://developers.lightspeedhq.com before production.
//
// OAuth2 authorization_code flow. shop_id comes from config.

import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  Credentials,
  FetchWindow,
  FiscalIntegrationRow,
  NormalizedReceipt,
  OAuthCredentials,
  ProviderConfig,
  ReceiptEvent,
} from "../../types.ts";
import type { PosAdapter } from "../types.ts";
import {
  lightspeedReceiptSchema,
  lightspeedWebhookBodySchema,
  type LightspeedReceipt,
} from "./schemas.ts";

const LS_AUTH_URL = "https://api.lightspeedapp.com/oauth/authorize";
const LS_TOKEN_URL = "https://api.lightspeedapp.com/oauth/access_token";
const LS_API_BASE = "https://api.lightspeedapp.com/K/V2";

function clientId(): string {
  const id = process.env.POS_LIGHTSPEED_CLIENT_ID;
  if (!id) throw new Error("POS_LIGHTSPEED_CLIENT_ID env var not set");
  return id;
}
function clientSecret(): string {
  const s = process.env.POS_LIGHTSPEED_CLIENT_SECRET;
  if (!s) throw new Error("POS_LIGHTSPEED_CLIENT_SECRET env var not set");
  return s;
}

function toCents(euro: number): number {
  return Math.round(euro * 100);
}

function statusFrom(
  event: ReceiptEvent["event_type"],
  receiptStatus: LightspeedReceipt["status"],
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
      `Lightspeed ${init?.method ?? "GET"} ${url} failed: ${r.status} ${body}`,
    );
  }
  return r.json();
}

export const lightspeedAdapter: PosAdapter = {
  provider: "lightspeed",

  getAuthUrl(state: string, redirectUri: string): string {
    const u = new URL(LS_AUTH_URL);
    u.searchParams.set("client_id", clientId());
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("state", state);
    u.searchParams.set("scope", "employee:register_read employee:transactions_read");
    return u.toString();
  },

  async exchangeCode(code: string, redirectUri: string): Promise<Credentials> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri,
    });
    const res = (await fetchJSON(LS_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    })) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    return {
      kind: "oauth2",
      access_token: res.access_token,
      refresh_token: res.refresh_token,
      expires_at: res.expires_in
        ? new Date(Date.now() + res.expires_in * 1000).toISOString()
        : undefined,
      scope: res.scope,
    };
  },

  async refreshCredentials(creds: Credentials): Promise<Credentials> {
    if (creds.kind !== "oauth2" || !creds.refresh_token) {
      throw new Error(
        "lightspeed.refreshCredentials requires oauth2 creds with refresh_token",
      );
    }
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: creds.refresh_token,
      client_id: clientId(),
      client_secret: clientSecret(),
    });
    const res = (await fetchJSON(LS_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    })) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    return {
      kind: "oauth2",
      access_token: res.access_token,
      refresh_token: res.refresh_token ?? creds.refresh_token,
      expires_at: res.expires_in
        ? new Date(Date.now() + res.expires_in * 1000).toISOString()
        : undefined,
    };
  },

  async *fetchReceipts(
    creds: Credentials,
    config: ProviderConfig,
    window: FetchWindow,
  ): AsyncIterable<ReceiptEvent> {
    if (creds.kind !== "oauth2") {
      throw new Error("lightspeed.fetchReceipts requires oauth2 creds");
    }
    const token = (creds as OAuthCredentials).access_token;
    const shop = config.shop_id;
    let cursor: string | undefined;
    for (;;) {
      const u = new URL(`${LS_API_BASE}/receipts`);
      u.searchParams.set("since", window.since.toISOString());
      if (window.until) u.searchParams.set("until", window.until.toISOString());
      if (shop) u.searchParams.set("locationId", String(shop));
      if (cursor) u.searchParams.set("cursor", cursor);
      u.searchParams.set("limit", "100");

      const res = (await fetchJSON(u.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      })) as { data: unknown[]; nextCursor?: string };

      for (const raw of res.data ?? []) {
        const parsed = lightspeedReceiptSchema.safeParse(raw);
        if (!parsed.success) continue;
        const eventType: ReceiptEvent["event_type"] =
          parsed.data.status === "CANCELLED"
            ? "receipt.voided"
            : parsed.data.status === "REFUNDED"
              ? "receipt.refunded"
              : "receipt.created";
        yield {
          external_id: parsed.data.uuid,
          event_type: eventType,
          payload: parsed.data,
        };
      }
      if (!res.nextCursor) break;
      cursor = res.nextCursor;
    }
  },

  verifyWebhook(headers, body, secret): boolean {
    const sig =
      headers["x-lightspeed-signature"] ?? headers["X-Lightspeed-Signature"];
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
    const parsed = lightspeedWebhookBodySchema.safeParse(json);
    if (!parsed.success) return [];
    const eventType: ReceiptEvent["event_type"] =
      parsed.data.event === "receipt.cancelled"
        ? "receipt.voided"
        : parsed.data.event === "receipt.refunded"
          ? "receipt.refunded"
          : "receipt.created";
    return [
      {
        external_id: parsed.data.payload.uuid,
        event_type: eventType,
        payload: parsed.data.payload,
      },
    ];
  },

  normalize(
    rawEvent: ReceiptEvent,
    _integration: Pick<FiscalIntegrationRow, "id" | "restaurant_id" | "config">,
  ): NormalizedReceipt | null {
    const parsed = lightspeedReceiptSchema.safeParse(rawEvent.payload);
    if (!parsed.success) return null;
    const r = parsed.data;
    const items = r.items.map((it, idx) => {
      const unit = toCents(it.unitPrice);
      const discount = toCents(it.discountValue ?? 0);
      return {
        line_number: idx + 1,
        pos_item_id: it.id,
        name: it.name,
        category: it.categoryName ?? null,
        quantity: it.quantity,
        unit_price_cents: unit,
        subtotal_cents: Math.max(0, unit * it.quantity - discount),
        vat_rate: it.taxRate ?? null,
        discount_cents: discount,
        is_voided: it.cancelled ?? false,
      };
    });
    return {
      external_id: r.uuid,
      issued_at: r.closedAt,
      business_day: r.closedAt.slice(0, 10),
      status: statusFrom(rawEvent.event_type, r.status),
      subtotal_cents: toCents(r.subtotalExTax),
      vat_cents: toCents(r.taxTotal),
      total_cents: toCents(r.total),
      payment_method: r.paymentMethod ?? null,
      operator_name: r.cashierName ?? null,
      table_ref: r.tableNumber ?? null,
      covers: r.guestCount ?? null,
      metadata: { receipt_number: r.receiptNumber ?? null },
      items,
    };
  },
};
