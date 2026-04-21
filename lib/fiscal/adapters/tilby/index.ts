// lib/fiscal/adapters/tilby/index.ts
// Tilby (Zucchetti) POS adapter.
// Endpoints: confirm against https://developers.tilby.com before production.
//
// OAuth2 authorization_code flow:
//   1. Redirect user to TILBY_AUTH_URL?client_id=...&redirect_uri=...&response_type=code&state=...
//   2. Tilby redirects back with `code` → exchangeCode() → { access_token, refresh_token }
//   3. fetchReceipts uses Bearer token; refreshCredentials when expired.

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
  tilbyReceiptSchema,
  tilbyWebhookBodySchema,
  type TilbyReceipt,
} from "./schemas.ts";

const TILBY_AUTH_URL = "https://tilby.com/oauth/authorize";
const TILBY_TOKEN_URL = "https://tilby.com/oauth/token";
const TILBY_API_BASE = "https://tilby.com/api/v1";

function clientId(): string {
  const id = process.env.POS_TILBY_CLIENT_ID;
  if (!id) throw new Error("POS_TILBY_CLIENT_ID env var not set");
  return id;
}
function clientSecret(): string {
  const s = process.env.POS_TILBY_CLIENT_SECRET;
  if (!s) throw new Error("POS_TILBY_CLIENT_SECRET env var not set");
  return s;
}

function toCents(euro: number): number {
  return Math.round(euro * 100);
}

function statusFrom(
  event: ReceiptEvent["event_type"],
  receiptStatus: TilbyReceipt["status"],
): NormalizedReceipt["status"] {
  if (event === "receipt.voided" || receiptStatus === "cancelled")
    return "voided";
  if (event === "receipt.refunded" || receiptStatus === "refunded")
    return "refunded";
  return "issued";
}

async function fetchJSON(url: string, init?: RequestInit): Promise<unknown> {
  const r = await fetch(url, init);
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(
      `Tilby ${init?.method ?? "GET"} ${url} failed: ${r.status} ${body}`,
    );
  }
  return r.json();
}

export const tilbyAdapter: PosAdapter = {
  provider: "tilby",

  getAuthUrl(state: string, redirectUri: string): string {
    const u = new URL(TILBY_AUTH_URL);
    u.searchParams.set("client_id", clientId());
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("state", state);
    u.searchParams.set("scope", "receipts:read products:read");
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
    const res = (await fetchJSON(TILBY_TOKEN_URL, {
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
        "tilby.refreshCredentials requires oauth2 creds with refresh_token",
      );
    }
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: creds.refresh_token,
      client_id: clientId(),
      client_secret: clientSecret(),
    });
    const res = (await fetchJSON(TILBY_TOKEN_URL, {
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
      throw new Error("tilby.fetchReceipts requires oauth2 creds");
    }
    const token = (creds as OAuthCredentials).access_token;
    const shop = config.shop_id;
    let page = 1;
    const pageSize = 100;
    for (;;) {
      const u = new URL(`${TILBY_API_BASE}/receipts`);
      u.searchParams.set("page", String(page));
      u.searchParams.set("per_page", String(pageSize));
      u.searchParams.set("since", window.since.toISOString());
      if (window.until) u.searchParams.set("until", window.until.toISOString());
      if (shop) u.searchParams.set("shop_id", String(shop));

      const res = (await fetchJSON(u.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      })) as { data: unknown[]; has_more?: boolean };

      for (const raw of res.data) {
        const parsed = tilbyReceiptSchema.safeParse(raw);
        if (!parsed.success) continue;
        const eventType: ReceiptEvent["event_type"] =
          parsed.data.status === "cancelled"
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
      if (!res.has_more || res.data.length < pageSize) break;
      page += 1;
    }
  },

  verifyWebhook(headers, body, secret): boolean {
    const sig = headers["x-tilby-signature"] ?? headers["X-Tilby-Signature"];
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
    const parsed = tilbyWebhookBodySchema.safeParse(json);
    if (!parsed.success) return [];
    const eventType: ReceiptEvent["event_type"] =
      parsed.data.event === "receipt.cancelled"
        ? "receipt.voided"
        : parsed.data.event === "receipt.refunded"
          ? "receipt.refunded"
          : "receipt.created";
    return [
      {
        external_id: parsed.data.receipt.id,
        event_type: eventType,
        payload: parsed.data.receipt,
      },
    ];
  },

  normalize(
    rawEvent: ReceiptEvent,
    _integration: Pick<FiscalIntegrationRow, "id" | "restaurant_id" | "config">,
  ): NormalizedReceipt | null {
    const parsed = tilbyReceiptSchema.safeParse(rawEvent.payload);
    if (!parsed.success) return null;
    const r = parsed.data;
    const items = r.items.map((it, idx) => {
      const quantity = it.quantity;
      const unit = toCents(it.price);
      const discount = toCents(it.discount_amount ?? 0);
      return {
        line_number: idx + 1,
        pos_item_id: it.id,
        name: it.name,
        category: it.category_name ?? null,
        quantity,
        unit_price_cents: unit,
        subtotal_cents: Math.max(0, unit * quantity - discount),
        vat_rate: it.vat_percentage ?? null,
        discount_cents: discount,
        is_voided: it.is_cancelled ?? false,
      };
    });
    return {
      external_id: r.id,
      issued_at: r.sell_datetime,
      business_day: r.sell_datetime.slice(0, 10),
      status: statusFrom(rawEvent.event_type, r.status),
      subtotal_cents: toCents(r.subtotal),
      vat_cents: toCents(r.vat_total),
      total_cents: toCents(r.total),
      payment_method: r.payment_method ?? null,
      operator_name: r.operator_name ?? null,
      table_ref: r.table_name ?? null,
      covers: r.customer_count ?? null,
      metadata: { receipt_number: r.receipt_number ?? null },
      items,
    };
  },
};
