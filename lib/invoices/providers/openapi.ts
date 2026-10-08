// lib/invoices/providers/openapi.ts
// Openapi.com "SDI API" (Fatturazione Elettronica SDI) adapter — passive
// invoices only.
//
// Docs (not reachable from the build sandbox, checked through public search
// results and an open-source integration, Solede-SA/italian_invoice):
//   console.openapi.com/apis/sdi/documentation · /faq · /pricing
//
// What is CONFIRMED by those sources:
//   * hosts: https://sdi.openapi.it (production), https://test.sdi.openapi.it (sandbox)
//   * POST /business_registry_configurations  — register the company (fiscal_id,
//     name, email, apply_signature, apply_legal_storage)
//   * POST /api_configurations { fiscal_id, callbacks: [{ event, url, auth_header }] }
//     with event "supplier-invoice" for passive invoices
//   * the supplier-invoice callback body: { event, data: { invoice: { uuid,
//     payload: { fattura_elettronica_header, fattura_elettronica_body } } } }
//     (older format without "payload")
//   * GET /invoices (list), GET /invoices/{uuid}, GET /invoices_download/{uuid}
//   * codice destinatario to register at the Agenzia delle Entrate: JKKZDGR
//     (CONFLICT: an Openapi FAQ of the "invoice" product mentions PIC7CPS for
//     supplier_invoice. Verify in the console which code applies to the SDI
//     API account and set OPENAPI_SDI_RECIPIENT_CODE accordingly — the wizard
//     shows whatever is configured / stored at registration.)
//
// ASSUMPTIONS (marked TODO(openapi) below, verify on the sandbox before go-live):
//   * auth header "Authorization: Bearer <token>" (token from console.openapi.com)
//   * the callback carries our `auth_header` value in its Authorization header
//   * GET /invoices filters: type=1 (passive), recipient=<P.IVA>, page, per_page;
//     each item has uuid + created_at (we also filter client-side)
//   * GET /invoices_download/{uuid} returns the original XML / p7m bytes
//
// Configuration (env only, never hard-coded):
//   OPENAPI_SDI_TOKEN          bearer token (required)
//   OPENAPI_SDI_ENV            sandbox | production (default sandbox)
//   OPENAPI_SDI_BASE_URL       optional override of the host
//   OPENAPI_SDI_RECIPIENT_CODE optional override of the codice destinatario
//   INVOICES_WEBHOOK_SECRET    shared secret for the callback auth header (required)

import { normalizeVat } from "../fatturapa.ts";
import {
  ProviderError,
  type ParsedWebhook,
  type ProviderInvoiceDocument,
  type ProviderInvoiceRef,
  type ProviderStatus,
  type RegisterCompanyInput,
  type RegisterCompanyResult,
  type SdiProvider,
} from "./types.ts";

const DEFAULT_RECIPIENT_CODE = "JKKZDGR";
const TIMEOUT_MS = 20_000;

/** Constant-time string compare (pure JS: usable in tests and any runtime). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function env(name: string): string | null {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : null;
}

function environment(): "sandbox" | "production" {
  return env("OPENAPI_SDI_ENV") === "production" ? "production" : "sandbox";
}

function baseUrl(): string {
  return (
    env("OPENAPI_SDI_BASE_URL") ??
    (environment() === "production" ? "https://sdi.openapi.it" : "https://test.sdi.openapi.it")
  ).replace(/\/+$/, "");
}

function authHeader(): string {
  const token = env("OPENAPI_SDI_TOKEN");
  if (!token) throw new ProviderError("OPENAPI_SDI_TOKEN non impostato");
  // TODO(openapi): confirm the scheme on the sandbox (Bearer per console docs).
  return /^bearer\s/i.test(token) ? token : `Bearer ${token}`;
}

/** Value Openapi must echo in the callback Authorization header. */
export function webhookAuthValue(): string | null {
  const secret = env("INVOICES_WEBHOOK_SECRET");
  return secret ? `Bearer ${secret}` : null;
}

async function call(path: string, init: RequestInit & { accept?: string } = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: {
        Authorization: authHeader(),
        Accept: init.accept ?? "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
      signal: ctrl.signal,
      cache: "no-store",
    });
    return res;
  } catch (err) {
    throw new ProviderError(`Openapi non raggiungibile: ${err instanceof Error ? err.message : "errore di rete"}`);
  } finally {
    clearTimeout(timer);
  }
}

async function json<T>(res: Response, what: string): Promise<T> {
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const msg = (body as { message?: string } | null)?.message ?? text.slice(0, 200) ?? res.statusText;
    throw new ProviderError(`${what}: ${msg || `HTTP ${res.status}`}`, res.status);
  }
  return body as T;
}

function pick(obj: unknown, ...path: string[]): unknown {
  let cur: unknown = obj;
  for (const p of path) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/** Deep search of the first value at a dotted key path (payload shapes vary). */
function deepFind(obj: unknown, keys: string[]): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const direct = pick(obj, ...keys);
  if (direct !== undefined) return direct;
  for (const v of Object.values(obj as Record<string, unknown>)) {
    const hit = deepFind(v, keys);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

export const openapiProvider: SdiProvider = {
  id: "openapi",
  label: "Openapi SDI",

  status(): ProviderStatus {
    const missing: string[] = [];
    if (!env("OPENAPI_SDI_TOKEN")) missing.push("OPENAPI_SDI_TOKEN");
    if (!env("INVOICES_WEBHOOK_SECRET")) missing.push("INVOICES_WEBHOOK_SECRET");
    if (!env("NEXT_PUBLIC_APP_URL")) missing.push("NEXT_PUBLIC_APP_URL");
    return { configured: missing.length === 0, environment: missing.length === 0 ? environment() : null, missing };
  },

  recipientCode(): string | null {
    return env("OPENAPI_SDI_RECIPIENT_CODE") ?? DEFAULT_RECIPIENT_CODE;
  },

  async registerCompany(input: RegisterCompanyInput): Promise<RegisterCompanyResult> {
    const fiscalId = normalizeVat(input.fiscalId) ?? input.fiscalId;
    // 1. Company ("business registry configuration"). Receiving only: no
    //    signature, no legal storage (the accountant keeps the archive).
    const reg = await call("/business_registry_configurations", {
      method: "POST",
      body: JSON.stringify({
        fiscal_id: fiscalId,
        name: input.companyName,
        email: input.email ?? undefined,
        apply_signature: false,
        apply_legal_storage: false,
      }),
    });
    // 409/422 = already registered under our account: treat as success.
    let providerRef: string | null = null;
    if (reg.status !== 409 && reg.status !== 422) {
      const body = await json<unknown>(reg, "Registrazione azienda");
      const id = deepFind(body, ["id"]) ?? deepFind(body, ["fiscal_id"]);
      providerRef = typeof id === "string" ? id : null;
    }
    // 2. Callback for passive invoices.
    const cfg = await call("/api_configurations", {
      method: "POST",
      body: JSON.stringify({
        fiscal_id: fiscalId,
        callbacks: [{ event: "supplier-invoice", url: input.webhookUrl, auth_header: input.webhookAuthHeader }],
      }),
    });
    const webhookConfigured = cfg.ok || cfg.status === 409;
    if (!webhookConfigured) await json<unknown>(cfg, "Configurazione notifiche");
    return { recipientCode: this.recipientCode() ?? DEFAULT_RECIPIENT_CODE, providerRef, webhookConfigured };
  },

  async *listSupplierInvoices({ fiscalId, since }): AsyncIterable<ProviderInvoiceRef> {
    const vat = normalizeVat(fiscalId) ?? fiscalId;
    for (let page = 1; page <= 20; page++) {
      // TODO(openapi): confirm the filter names on the sandbox.
      const qs = new URLSearchParams({ type: "1", recipient: vat, page: String(page), per_page: "100" });
      const res = await call(`/invoices?${qs.toString()}`);
      const body = await json<unknown>(res, "Elenco fatture");
      const items = (pick(body, "data") ?? []) as unknown[];
      if (!Array.isArray(items) || items.length === 0) return;
      let older = 0;
      for (const it of items) {
        const uuid = pick(it, "uuid") ?? pick(it, "id");
        if (typeof uuid !== "string") continue;
        const created = (pick(it, "created_at") as string | undefined) ?? null;
        if (created && Date.parse(created) < since.getTime()) {
          older++;
          continue;
        }
        const recipient = deepFind(it, ["cessionario_committente", "dati_anagrafici", "id_fiscale_iva", "id_codice"]) ?? pick(it, "recipient");
        if (typeof recipient === "string" && normalizeVat(recipient) !== vat) continue;
        yield { externalId: uuid, receivedAt: created, recipientFiscalId: vat };
      }
      if (items.length < 100 || older === items.length) return;
    }
  },

  async downloadInvoice(ref: ProviderInvoiceRef): Promise<ProviderInvoiceDocument> {
    // TODO(openapi): confirm that invoices_download returns the original file.
    const res = await call(`/invoices_download/${encodeURIComponent(ref.externalId)}`, { accept: "application/xml" });
    if (res.ok) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      const head = new TextDecoder().decode(bytes.subarray(0, 64)).trimStart();
      if (!head.startsWith("{")) {
        return { externalId: ref.externalId, fileName: `${ref.externalId}.xml`, recipientFiscalId: ref.recipientFiscalId, bytes };
      }
    }
    // Fallback: the JSON rendering of the invoice.
    const detail = await json<unknown>(await call(`/invoices/${encodeURIComponent(ref.externalId)}`), "Dettaglio fattura");
    const payload = deepFind(detail, ["payload"]) ?? pick(detail, "data");
    return { externalId: ref.externalId, fileName: `${ref.externalId}.json`, recipientFiscalId: ref.recipientFiscalId, json: payload };
  },

  async verifyWebhook(headers: Headers, rawBody: string): Promise<boolean> {
    const expected = webhookAuthValue();
    if (!expected) return false;
    const auth = headers.get("authorization") ?? "";
    if (auth && safeEqual(auth, expected)) return true;
    // Optional HMAC signature (sha256 of the raw body with the shared secret).
    const sig = headers.get("x-webhook-signature");
    const secret = env("INVOICES_WEBHOOK_SECRET");
    if (sig && secret) {
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
      const hex = Array.from(mac).map((b) => b.toString(16).padStart(2, "0")).join("");
      return safeEqual(sig.replace(/^sha256=/, "").toLowerCase(), hex);
    }
    return false;
  },

  parseWebhook(body: unknown): ParsedWebhook {
    const event = String(pick(body, "event") ?? "");
    const invoice = pick(body, "data", "invoice") ?? pick(body, "invoice") ?? pick(body, "data");
    const uuid = pick(invoice, "uuid") ?? pick(body, "data", "uuid");
    const recipient = deepFind(invoice, ["cessionario_committente", "dati_anagrafici", "id_fiscale_iva", "id_codice"]);
    const isSupplier = event === "supplier-invoice" || event === "supplier_invoice";
    const payload = pick(invoice, "payload") ?? (pick(invoice, "fattura_elettronica_header") ? invoice : undefined);
    return {
      kind: isSupplier ? "supplier_invoice" : "other",
      event: event || "unknown",
      externalId: typeof uuid === "string" ? uuid : null,
      recipientFiscalId: typeof recipient === "string" ? normalizeVat(recipient) : null,
      document:
        isSupplier && typeof uuid === "string"
          ? {
              externalId: uuid,
              fileName: `${uuid}.json`,
              recipientFiscalId: typeof recipient === "string" ? normalizeVat(recipient) : null,
              json: payload,
            }
          : null,
    };
  },
};
