# Cassetto Fiscale — Plan 2: Adapter Framework + Tilby + Mock + Generic Webhook

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define the `PosAdapter` interface + implement 3 adapters (mock, generic_webhook, tilby) + credentials helpers for Node + zod schemas + unit tests. End state: adapters callable from Node with fixture data; Tilby OAuth + receipt fetch + normalize wired (endpoints documented in code, validate against live Tilby dev portal before Plan 3).

**Architecture:** Adapters live in `lib/fiscal/adapters/<provider>/`. Pure TS modules, no Next.js-specific imports — must compile both for Node (route handlers) and Deno (future edge fn in Plan 3). Credentials are encrypted at rest via the SQL fn from Plan 1; Node code accesses them via Supabase service-role RPC.

**Tech Stack:** TypeScript strict, `zod/v4` schemas, `node:test` + `node:assert/strict` for unit tests (Node 24 runs TS natively via `--experimental-strip-types`), Supabase service-role client from `lib/supabase/admin.ts`.

**Spec reference:** `docs/superpowers/specs/2026-04-20-cassetto-fiscale-design.md` §5.

---

## Prerequisites

- Plan 1 completed. DB has `fiscal_integrations`, `fiscal_raw_events`, helper fn `fiscal_encrypt_credentials` / `fiscal_decrypt_credentials`, vault `fiscal_master_key` set.
- Branch: continue on `feat/cassetto-fiscale-phase1` (rename to `-phase2` optional — keep single branch for the feature).

---

## File Structure

**Create:**
- `lib/fiscal/types.ts` — shared types (Credentials union, NormalizedReceipt, NormalizedReceiptItem, DbIntegration)
- `lib/fiscal/credentials.ts` — Node helpers: `encryptCredentials`, `decryptCredentials`, `getCredentials`, `saveCredentials`
- `lib/fiscal/adapters/types.ts` — `PosAdapter` interface + `RawReceipt` zod + helper types
- `lib/fiscal/adapters/registry.ts` — map `FiscalProvider → PosAdapter`
- `lib/fiscal/adapters/mock/index.ts` — in-memory adapter driven by fixtures
- `lib/fiscal/adapters/mock/fixtures.ts` — sample receipts data
- `lib/fiscal/adapters/mock/index.test.ts` — unit tests
- `lib/fiscal/adapters/generic-webhook/index.ts` — HMAC-SHA256 verify + JSON body parse
- `lib/fiscal/adapters/generic-webhook/index.test.ts`
- `lib/fiscal/adapters/tilby/index.ts` — OAuth2 + fetch + normalize + webhook verify
- `lib/fiscal/adapters/tilby/schemas.ts` — zod for Tilby payloads
- `lib/fiscal/adapters/tilby/index.test.ts`
- `lib/fiscal/normalizer.ts` — dispatch raw event → normalized rows (service-role DB writes)
- `lib/fiscal/normalizer.test.ts`
- `scripts/fiscal-test.mjs` — wrapper script that runs `node --test --experimental-strip-types "lib/fiscal/**/*.test.ts"`

**Modify:**
- `package.json` — add `"test:fiscal": "node --test --experimental-strip-types lib/fiscal/**/*.test.ts"`.

**No files modified in `app/`.** This plan is pure library + tests. UI arrives in Plan 4.

---

## Task 1: Test runner script in package.json

**Files:**
- Modify: `D:\Manum\GastroBridge\package.json`

- [ ] **Step 1: Inspect current scripts**

```bash
cd D:/Manum/GastroBridge && grep -A3 '"scripts"' package.json
```

- [ ] **Step 2: Add test:fiscal script**

Read `package.json` first with the Read tool. Then `Edit` the `"scripts"` block to add:

```json
"test:fiscal": "node --test --experimental-strip-types --experimental-transform-types \"lib/fiscal/**/*.test.ts\""
```

Place it AFTER `"lint"` and BEFORE the closing `}`. Preserve trailing comma rules.

Example end state (fragment):
```json
"scripts": {
  "dev": "set NODE_OPTIONS=--max-http-header-size=65536&& next dev --turbopack",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test:fiscal": "node --test --experimental-strip-types --experimental-transform-types \"lib/fiscal/**/*.test.ts\""
},
```

- [ ] **Step 3: Sanity check script resolves (will fail with "no files" for now)**

```bash
cd D:/Manum/GastroBridge && npm run test:fiscal 2>&1 | head -5
```

Expected: some variant of "pattern did not match any files" or "0 tests run" — the script itself must be valid. If the shell errors on the escape quoting, swap to a glob-free invocation (e.g., skip glob for now and we'll add explicit file paths in later tasks):

```json
"test:fiscal": "node --test --experimental-strip-types --experimental-transform-types"
```

Then plan will invoke with explicit paths: `npm run test:fiscal -- lib/fiscal/types.test.ts` etc. Use whichever works on this Windows + Node 24 setup.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore(fiscal): add test:fiscal npm script using node --test + strip-types"
```

---

## Task 2: Shared types in lib/fiscal/types.ts

**Files:**
- Create: `lib/fiscal/types.ts`

- [ ] **Step 1: Write file**

```typescript
// lib/fiscal/types.ts
// Shared types for the Cassetto Fiscale module.

import type { Database, FiscalProvider, FiscalIntegrationStatus, FiscalReceiptStatus } from "@/types/database";

type Tbl<K extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][K]["Row"];

export type FiscalIntegrationRow = Tbl<"fiscal_integrations">;
export type FiscalReceiptRow     = Tbl<"fiscal_receipts">;
export type FiscalReceiptItemRow = Tbl<"fiscal_receipt_items">;
export type FiscalPosItemRow     = Tbl<"fiscal_pos_items">;

export interface OAuthCredentials {
  kind: "oauth2";
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  scope?: string;
}

export interface ApiKeyCredentials {
  kind: "api_key";
  api_key: string;
  shop_id?: string;
}

export type Credentials = OAuthCredentials | ApiKeyCredentials;

export interface NormalizedReceiptItem {
  line_number: number;
  pos_item_id: string | null;
  name: string;
  category: string | null;
  quantity: number;
  unit_price_cents: number;
  subtotal_cents: number;
  vat_rate: number | null;
  discount_cents: number;
  is_voided: boolean;
}

export interface NormalizedReceipt {
  external_id: string;
  issued_at: string;            // ISO 8601
  business_day: string;         // YYYY-MM-DD
  status: FiscalReceiptStatus;
  subtotal_cents: number;
  vat_cents: number;
  total_cents: number;
  payment_method: string | null;
  operator_name: string | null;
  table_ref: string | null;
  covers: number | null;
  metadata: Record<string, unknown>;
  items: NormalizedReceiptItem[];
}

export interface ProviderConfig {
  [key: string]: unknown;
  device_id?: string;
  shop_id?: string;
  timezone?: string;
}

export interface FetchWindow {
  since: Date;
  until?: Date;
}

export interface ReceiptEvent {
  external_id: string;
  event_type: "receipt.created" | "receipt.voided" | "receipt.refunded";
  payload: unknown;
}

export { type FiscalProvider, type FiscalIntegrationStatus, type FiscalReceiptStatus };
```

- [ ] **Step 2: TypeCheck**

```bash
cd D:/Manum/GastroBridge && npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/fiscal/types.ts
git commit -m "feat(fiscal): shared types (credentials, NormalizedReceipt)"
```

---

## Task 3: Credentials helpers (Node)

**Files:**
- Create: `lib/fiscal/credentials.ts`

- [ ] **Step 1: Write file**

```typescript
// lib/fiscal/credentials.ts
// Node-side helpers that call the SECURITY DEFINER SQL functions
// fiscal_encrypt_credentials / fiscal_decrypt_credentials.
// Requires the SERVICE ROLE Supabase client — never call from a browser.

import { createAdminClient } from "@/lib/supabase/admin";
import type { Credentials } from "./types";

export async function encryptCredentials(creds: Credentials): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("fiscal_encrypt_credentials", {
    plaintext: creds as unknown as Record<string, unknown>,
  });
  if (error) throw new Error(`encryptCredentials failed: ${error.message}`);
  if (!data) throw new Error("encryptCredentials returned null");
  // Supabase returns bytea as hex-encoded "\\x..." string. Pass-through.
  return data as unknown as string;
}

export async function decryptCredentials(ciphertext: string): Promise<Credentials> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("fiscal_decrypt_credentials", {
    ciphertext: ciphertext as unknown as string,
  });
  if (error) throw new Error(`decryptCredentials failed: ${error.message}`);
  if (!data) throw new Error("decryptCredentials returned null");
  return data as unknown as Credentials;
}

export async function loadCredentials(integrationId: string): Promise<Credentials | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("fiscal_integrations")
    .select("credentials_encrypted")
    .eq("id", integrationId)
    .single();
  if (error) throw new Error(`loadCredentials query failed: ${error.message}`);
  const enc = (data as { credentials_encrypted: string | null } | null)?.credentials_encrypted;
  if (!enc) return null;
  return decryptCredentials(enc);
}

export async function saveCredentials(integrationId: string, creds: Credentials): Promise<void> {
  const supabase = createAdminClient();
  const enc = await encryptCredentials(creds);
  const { error } = await supabase
    .from("fiscal_integrations")
    .update({ credentials_encrypted: enc })
    .eq("id", integrationId);
  if (error) throw new Error(`saveCredentials failed: ${error.message}`);
}
```

- [ ] **Step 2: Verify admin client export**

```bash
cd D:/Manum/GastroBridge && grep -n "export" lib/supabase/admin.ts | head -3
```

If the client factory is named differently (e.g., `createClient` instead of `createAdminClient`), update the import accordingly. Read `lib/supabase/admin.ts` to confirm. If the exported function takes no args, the call site `createAdminClient()` matches. Fix both to align.

- [ ] **Step 3: TypeCheck**

```bash
cd D:/Manum/GastroBridge && npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add lib/fiscal/credentials.ts
git commit -m "feat(fiscal): node helpers for credential encrypt/decrypt/load/save"
```

---

## Task 4: PosAdapter interface + registry

**Files:**
- Create: `lib/fiscal/adapters/types.ts`
- Create: `lib/fiscal/adapters/registry.ts`

- [ ] **Step 1: Write types.ts**

```typescript
// lib/fiscal/adapters/types.ts
import { z } from "zod/v4";
import type {
  Credentials,
  FetchWindow,
  FiscalIntegrationRow,
  FiscalProvider,
  NormalizedReceipt,
  ProviderConfig,
  ReceiptEvent,
} from "../types";

export interface RawPosItem {
  pos_item_id: string;
  name: string;
  category?: string | null;
  last_seen_at?: string;
}

export interface PosAdapter {
  readonly provider: FiscalProvider;

  // OAuth2 flow (optional — API-key providers skip)
  getAuthUrl?(state: string, redirectUri: string): string;
  exchangeCode?(code: string, redirectUri: string): Promise<Credentials>;
  refreshCredentials?(creds: Credentials): Promise<Credentials>;

  // Data pull
  fetchReceipts(
    creds: Credentials,
    config: ProviderConfig,
    window: FetchWindow,
  ): AsyncIterable<ReceiptEvent>;

  fetchCatalog?(
    creds: Credentials,
    config: ProviderConfig,
  ): AsyncIterable<RawPosItem>;

  // Webhook (optional)
  verifyWebhook?(
    headers: Record<string, string>,
    body: string,
    secret: string,
  ): boolean;
  parseWebhook?(body: string): ReceiptEvent[];

  // Pure transform — takes raw payload, returns normalized receipt.
  normalize(
    rawEvent: ReceiptEvent,
    integration: Pick<FiscalIntegrationRow, "id" | "restaurant_id" | "config">,
  ): NormalizedReceipt | null;
}

// Zod schemas reused across provider adapters.
export const receiptEventSchema = z.object({
  external_id: z.string().min(1),
  event_type: z.enum(["receipt.created", "receipt.voided", "receipt.refunded"]),
  payload: z.unknown(),
});

export type ReceiptEventSchema = z.infer<typeof receiptEventSchema>;
```

- [ ] **Step 2: Write registry.ts**

```typescript
// lib/fiscal/adapters/registry.ts
import type { FiscalProvider } from "../types";
import type { PosAdapter } from "./types";
import { mockAdapter } from "./mock";
import { genericWebhookAdapter } from "./generic-webhook";
import { tilbyAdapter } from "./tilby";

const registry: Partial<Record<FiscalProvider, PosAdapter>> = {
  tilby: tilbyAdapter,
  generic_webhook: genericWebhookAdapter,
  // `mock` is intentionally not a FiscalProvider — it is used by tests only.
};

export function getAdapter(provider: FiscalProvider): PosAdapter {
  const a = registry[provider];
  if (!a) {
    throw new Error(`No adapter registered for provider "${provider}"`);
  }
  return a;
}

export function getMockAdapter(): PosAdapter {
  return mockAdapter;
}
```

- [ ] **Step 3: Commit (these files will fail to TypeCheck until adapters exist — commit after Task 8)**

Skip commit here. We will commit the trio (types + registry + adapters) together to keep the tree compiling.

---

## Task 5: Mock adapter + fixtures

**Files:**
- Create: `lib/fiscal/adapters/mock/fixtures.ts`
- Create: `lib/fiscal/adapters/mock/index.ts`
- Create: `lib/fiscal/adapters/mock/index.test.ts`

- [ ] **Step 1: Fixtures**

```typescript
// lib/fiscal/adapters/mock/fixtures.ts
import type { ReceiptEvent } from "../../types";

export const mockReceiptEvents: ReceiptEvent[] = [
  {
    external_id: "mock-001",
    event_type: "receipt.created",
    payload: {
      id: "mock-001",
      ts: "2026-04-21T12:15:00+02:00",
      items: [
        { id: "p1", name: "Tagliata", qty: 1, unit_cents: 2200, vat: 10 },
        { id: "p2", name: "Calice Chianti", qty: 2, unit_cents: 800, vat: 10 },
      ],
      payment: "card",
      covers: 2,
      operator: "Luca",
    },
  },
  {
    external_id: "mock-002",
    event_type: "receipt.created",
    payload: {
      id: "mock-002",
      ts: "2026-04-21T13:40:00+02:00",
      items: [
        { id: "p3", name: "Margherita", qty: 2, unit_cents: 900, vat: 10 },
        { id: "p4", name: "Acqua", qty: 1, unit_cents: 300, vat: 10 },
      ],
      payment: "cash",
      covers: 2,
      operator: "Marta",
    },
  },
];
```

- [ ] **Step 2: Adapter**

```typescript
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
} from "../../types";
import type { PosAdapter } from "../types";
import { mockReceiptEvents } from "./fixtures";

function toCents(n: number): number {
  return Math.round(n);
}

type MockPayload = {
  id: string;
  ts: string;
  items: Array<{ id: string; name: string; qty: number; unit_cents: number; vat: number }>;
  payment: string;
  covers?: number;
  operator?: string;
};

export const mockAdapter: PosAdapter = {
  provider: "generic_webhook", // arbitrary, not actually used from the DB
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
      unit_price_cents: toCents(it.unit_cents),
      subtotal_cents: toCents(it.unit_cents * it.qty),
      vat_rate: it.vat,
      discount_cents: 0,
      is_voided: false,
    }));
    const subtotal = items.reduce((s, i) => s + i.subtotal_cents, 0);
    // simplification: 10% VAT single-bracket
    const vat = Math.round(subtotal * 0.10);
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
```

- [ ] **Step 3: Test**

```typescript
// lib/fiscal/adapters/mock/index.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mockAdapter } from "./index";
import { mockReceiptEvents } from "./fixtures";

test("mockAdapter.fetchReceipts yields all fixture events", async () => {
  const out: string[] = [];
  for await (const ev of mockAdapter.fetchReceipts(
    { kind: "api_key", api_key: "x" },
    {},
    { since: new Date(0) },
  )) {
    out.push(ev.external_id);
  }
  assert.deepEqual(out, mockReceiptEvents.map((e) => e.external_id));
});

test("mockAdapter.normalize produces correct totals for first fixture", () => {
  const integration = {
    id: "00000000-0000-0000-0000-000000000001",
    restaurant_id: "00000000-0000-0000-0000-000000000002",
    config: {},
  };
  const normalized = mockAdapter.normalize(mockReceiptEvents[0]!, integration)!;
  assert.equal(normalized.external_id, "mock-001");
  assert.equal(normalized.items.length, 2);
  // Tagliata 1 × 2200 + Chianti 2 × 800 = 3800 cents subtotal
  assert.equal(normalized.subtotal_cents, 3800);
  // 10% VAT = 380 cents
  assert.equal(normalized.vat_cents, 380);
  assert.equal(normalized.total_cents, 4180);
  assert.equal(normalized.payment_method, "card");
  assert.equal(normalized.covers, 2);
  assert.equal(normalized.business_day, "2026-04-21");
});

test("mockAdapter.normalize marks voided event correctly", () => {
  const evt = { ...mockReceiptEvents[0]!, event_type: "receipt.voided" as const };
  const integration = {
    id: "00000000-0000-0000-0000-000000000001",
    restaurant_id: "00000000-0000-0000-0000-000000000002",
    config: {},
  };
  const out = mockAdapter.normalize(evt, integration)!;
  assert.equal(out.status, "voided");
});
```

- [ ] **Step 4: Run tests**

```bash
cd D:/Manum/GastroBridge && node --test --experimental-strip-types --experimental-transform-types lib/fiscal/adapters/mock/index.test.ts
```

Expected: 3 passed, 0 failed.

- [ ] **Step 5: Commit (batched later — see Task 8)**

---

## Task 6: Generic webhook adapter

**Files:**
- Create: `lib/fiscal/adapters/generic-webhook/index.ts`
- Create: `lib/fiscal/adapters/generic-webhook/index.test.ts`

- [ ] **Step 1: Adapter**

```typescript
// lib/fiscal/adapters/generic-webhook/index.ts
// Adapter for POS that push events to our endpoint and sign the body
// with HMAC-SHA256 using the shared secret stored in fiscal_integrations.webhook_secret.
// Payload shape is our NormalizedReceipt-ish JSON (documented contract below).
//
// Expected body:
// {
//   "external_id": "...",
//   "event_type": "receipt.created" | "receipt.voided" | "receipt.refunded",
//   "issued_at": "2026-04-21T12:15:00+02:00",
//   "subtotal_cents": 3800,
//   "vat_cents": 380,
//   "total_cents": 4180,
//   "payment_method": "card",
//   "covers": 2,
//   "items": [ { "line_number": 1, "name": "...", "quantity": 1, "unit_price_cents": 2200, "subtotal_cents": 2200, "vat_rate": 10 } ]
// }

import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  Credentials,
  FetchWindow,
  FiscalIntegrationRow,
  NormalizedReceipt,
  ProviderConfig,
  ReceiptEvent,
} from "../../types";
import type { PosAdapter } from "../types";

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
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(String(sig), "hex");
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
```

- [ ] **Step 2: Test**

```typescript
// lib/fiscal/adapters/generic-webhook/index.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { genericWebhookAdapter } from "./index";

const SECRET = "test-secret-xyz";

function signed(body: string): string {
  return createHmac("sha256", SECRET).update(body).digest("hex");
}

test("verifyWebhook: correct signature accepted", () => {
  const body = JSON.stringify({ hello: "world" });
  const ok = genericWebhookAdapter.verifyWebhook!(
    { "x-gb-signature": signed(body) },
    body,
    SECRET,
  );
  assert.equal(ok, true);
});

test("verifyWebhook: wrong signature rejected", () => {
  const body = JSON.stringify({ hello: "world" });
  const ok = genericWebhookAdapter.verifyWebhook!(
    { "x-gb-signature": "00".repeat(32) },
    body,
    SECRET,
  );
  assert.equal(ok, false);
});

test("verifyWebhook: missing signature rejected", () => {
  const ok = genericWebhookAdapter.verifyWebhook!(
    {},
    "{}",
    SECRET,
  );
  assert.equal(ok, false);
});

test("parseWebhook + normalize round-trip", () => {
  const body = JSON.stringify({
    external_id: "gw-1",
    event_type: "receipt.created",
    issued_at: "2026-04-21T12:00:00+02:00",
    subtotal_cents: 1000,
    vat_cents: 100,
    total_cents: 1100,
    payment_method: "card",
    covers: 1,
    items: [
      { line_number: 1, name: "X", quantity: 1, unit_price_cents: 1000, subtotal_cents: 1000, vat_rate: 10 },
    ],
  });
  const events = genericWebhookAdapter.parseWebhook!(body);
  assert.equal(events.length, 1);
  assert.equal(events[0]!.external_id, "gw-1");

  const integration = { id: "i1", restaurant_id: "r1", config: {} };
  const normalized = genericWebhookAdapter.normalize(events[0]!, integration)!;
  assert.equal(normalized.total_cents, 1100);
  assert.equal(normalized.items.length, 1);
  assert.equal(normalized.business_day, "2026-04-21");
});
```

- [ ] **Step 3: Run tests**

```bash
cd D:/Manum/GastroBridge && node --test --experimental-strip-types --experimental-transform-types lib/fiscal/adapters/generic-webhook/index.test.ts
```

Expected: 4 passed.

---

## Task 7: Tilby adapter

**Files:**
- Create: `lib/fiscal/adapters/tilby/schemas.ts`
- Create: `lib/fiscal/adapters/tilby/index.ts`
- Create: `lib/fiscal/adapters/tilby/index.test.ts`

> **IMPORTANT — Tilby API endpoints.** Tilby (Zucchetti) REST API requires a developer account. The endpoints below follow the public Zucchetti Tilby documentation conventions (`https://tilby.com/api/v1/...`). **Validate exact base URL, auth endpoints, response shapes against the Tilby developer portal before enabling on production**. The adapter is structured so endpoint URLs and response schemas are swappable in one place (`schemas.ts` + constants at top of `index.ts`).

- [ ] **Step 1: Schemas**

```typescript
// lib/fiscal/adapters/tilby/schemas.ts
import { z } from "zod/v4";

export const tilbyReceiptItemSchema = z.object({
  id: z.string().or(z.number()).transform((v) => String(v)),
  name: z.string(),
  quantity: z.coerce.number(),
  price: z.coerce.number(),           // euro, may be decimal string
  vat_percentage: z.coerce.number().nullable().optional(),
  category_name: z.string().nullable().optional(),
  discount_amount: z.coerce.number().nullable().optional(),
  is_cancelled: z.boolean().optional(),
});

export const tilbyReceiptSchema = z.object({
  id: z.string().or(z.number()).transform((v) => String(v)),
  receipt_number: z.string().or(z.number()).transform((v) => String(v)).optional(),
  sell_datetime: z.string(),          // ISO 8601
  status: z.enum(["issued", "cancelled", "refunded"]).default("issued"),
  subtotal: z.coerce.number(),
  vat_total: z.coerce.number(),
  total: z.coerce.number(),
  payment_method: z.string().nullable().optional(),
  operator_name: z.string().nullable().optional(),
  customer_count: z.coerce.number().nullable().optional(),
  table_name: z.string().nullable().optional(),
  items: z.array(tilbyReceiptItemSchema),
});

export type TilbyReceipt = z.infer<typeof tilbyReceiptSchema>;

export const tilbyWebhookBodySchema = z.object({
  event: z.enum(["receipt.created", "receipt.cancelled", "receipt.refunded"]),
  receipt: tilbyReceiptSchema,
});

export type TilbyWebhookBody = z.infer<typeof tilbyWebhookBodySchema>;
```

- [ ] **Step 2: Adapter**

```typescript
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
} from "../../types";
import type { PosAdapter } from "../types";
import {
  tilbyReceiptSchema,
  tilbyWebhookBodySchema,
  type TilbyReceipt,
} from "./schemas";

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

function statusFrom(event: ReceiptEvent["event_type"], receiptStatus: TilbyReceipt["status"]): NormalizedReceipt["status"] {
  if (event === "receipt.voided" || receiptStatus === "cancelled") return "voided";
  if (event === "receipt.refunded" || receiptStatus === "refunded") return "refunded";
  return "issued";
}

async function fetchJSON(url: string, init?: RequestInit): Promise<unknown> {
  const r = await fetch(url, init);
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`Tilby ${init?.method ?? "GET"} ${url} failed: ${r.status} ${body}`);
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
    })) as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };
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
      throw new Error("tilby.refreshCredentials requires oauth2 creds with refresh_token");
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
    })) as { access_token: string; refresh_token?: string; expires_in?: number };
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
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
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
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(String(sig), "hex");
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
```

- [ ] **Step 3: Test**

```typescript
// lib/fiscal/adapters/tilby/index.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { tilbyAdapter } from "./index";

const WEBHOOK_SECRET = "tilby-secret-123";

const sampleReceipt = {
  id: "tlb-001",
  receipt_number: "2026-000123",
  sell_datetime: "2026-04-21T12:30:00+02:00",
  status: "issued" as const,
  subtotal: 38.00,
  vat_total: 3.80,
  total: 41.80,
  payment_method: "card",
  operator_name: "Luca",
  customer_count: 2,
  table_name: "T4",
  items: [
    { id: 101, name: "Tagliata", quantity: 1, price: 22.00, vat_percentage: 10, category_name: "Carni" },
    { id: 102, name: "Calice Chianti", quantity: 2, price: 8.00, vat_percentage: 10 },
  ],
};

test("tilby.verifyWebhook accepts valid signature", () => {
  const body = JSON.stringify({ event: "receipt.created", receipt: sampleReceipt });
  const sig = createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
  assert.equal(
    tilbyAdapter.verifyWebhook!({ "x-tilby-signature": sig }, body, WEBHOOK_SECRET),
    true,
  );
});

test("tilby.verifyWebhook rejects invalid signature", () => {
  const body = JSON.stringify({ event: "receipt.created", receipt: sampleReceipt });
  assert.equal(
    tilbyAdapter.verifyWebhook!({ "x-tilby-signature": "00".repeat(32) }, body, WEBHOOK_SECRET),
    false,
  );
});

test("tilby.parseWebhook unwraps wrapper", () => {
  const body = JSON.stringify({ event: "receipt.created", receipt: sampleReceipt });
  const events = tilbyAdapter.parseWebhook!(body);
  assert.equal(events.length, 1);
  assert.equal(events[0]!.external_id, "tlb-001");
  assert.equal(events[0]!.event_type, "receipt.created");
});

test("tilby.normalize converts payload to NormalizedReceipt", () => {
  const events = tilbyAdapter.parseWebhook!(
    JSON.stringify({ event: "receipt.created", receipt: sampleReceipt }),
  );
  const out = tilbyAdapter.normalize(events[0]!, {
    id: "i1",
    restaurant_id: "r1",
    config: {},
  })!;
  assert.equal(out.external_id, "tlb-001");
  assert.equal(out.subtotal_cents, 3800);
  assert.equal(out.vat_cents, 380);
  assert.equal(out.total_cents, 4180);
  assert.equal(out.items.length, 2);
  assert.equal(out.items[0]!.unit_price_cents, 2200);
  assert.equal(out.items[0]!.subtotal_cents, 2200);
  assert.equal(out.items[1]!.subtotal_cents, 1600);
  assert.equal(out.payment_method, "card");
  assert.equal(out.covers, 2);
  assert.equal(out.table_ref, "T4");
  assert.equal(out.business_day, "2026-04-21");
});

test("tilby.normalize marks refunded status correctly", () => {
  const refundedBody = JSON.stringify({
    event: "receipt.refunded",
    receipt: { ...sampleReceipt, status: "refunded" as const },
  });
  const [ev] = tilbyAdapter.parseWebhook!(refundedBody);
  const out = tilbyAdapter.normalize(ev!, { id: "i1", restaurant_id: "r1", config: {} })!;
  assert.equal(out.status, "refunded");
});
```

- [ ] **Step 4: Run tests**

```bash
cd D:/Manum/GastroBridge && node --test --experimental-strip-types --experimental-transform-types lib/fiscal/adapters/tilby/index.test.ts
```

Expected: 5 passed, 0 failed.

---

## Task 8: Commit adapters + types + registry together

- [ ] **Step 1: TypeCheck**

```bash
cd D:/Manum/GastroBridge && npx tsc --noEmit
```

Expected: exit 0. Fix any type errors inline before committing.

- [ ] **Step 2: Run all fiscal tests**

```bash
cd D:/Manum/GastroBridge && \
  node --test --experimental-strip-types --experimental-transform-types \
    lib/fiscal/adapters/mock/index.test.ts \
    lib/fiscal/adapters/generic-webhook/index.test.ts \
    lib/fiscal/adapters/tilby/index.test.ts
```

Expected: 12 passed (3 + 4 + 5), 0 failed.

- [ ] **Step 3: Stage and commit**

```bash
git add lib/fiscal/
git commit -m "feat(fiscal): adapter framework + mock + generic-webhook + tilby

PosAdapter interface + provider registry. Mock adapter for tests and
staging (fixture-driven). generic_webhook adapter (HMAC-SHA256 verify
with timing-safe compare, push-only). Tilby OAuth2 + paginated
receipt pull + webhook verify/parse + normalize, endpoints pulled
into constants for easy adjustment against the Tilby developer
portal. Zod schemas coerce decimal strings to numbers (subtotal in
euro → cents via Math.round).

12 unit tests passing (mock 3 + generic-webhook 4 + tilby 5).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Normalizer

**Files:**
- Create: `lib/fiscal/normalizer.ts`
- Create: `lib/fiscal/normalizer.test.ts`

- [ ] **Step 1: Implement**

```typescript
// lib/fiscal/normalizer.ts
// Process unprocessed fiscal_raw_events rows by dispatching to the
// correct adapter's normalize() and UPSERTing fiscal_receipts +
// fiscal_receipt_items + fiscal_pos_items.
//
// Invoked by:
//   - webhook route handler after INSERT (inline, sync)
//   - edge fn "fiscal-sync" after pull (batch)
//   - catch-up cron for rows with processed_at IS NULL

import { createAdminClient } from "@/lib/supabase/admin";
import { getAdapter } from "./adapters/registry";
import type { NormalizedReceipt } from "./types";

type RawEventRow = {
  id: number;
  integration_id: string;
  external_id: string;
  event_type: string;
  payload: unknown;
  processed_at: string | null;
};

type IntegrationRow = {
  id: string;
  restaurant_id: string;
  provider: string;
  config: Record<string, unknown>;
};

export interface NormalizeResult {
  processed: number;
  errors: Array<{ id: number; error: string }>;
}

export async function processUnprocessedEvents(limit = 100): Promise<NormalizeResult> {
  const supabase = createAdminClient();

  const { data: events, error: evErr } = await supabase
    .from("fiscal_raw_events")
    .select("id, integration_id, external_id, event_type, payload, processed_at")
    .is("processed_at", null)
    .order("received_at", { ascending: true })
    .limit(limit);

  if (evErr) throw new Error(`fetch unprocessed events: ${evErr.message}`);
  if (!events || events.length === 0) return { processed: 0, errors: [] };

  const integrationIds = Array.from(new Set((events as RawEventRow[]).map((e) => e.integration_id)));
  const { data: ints, error: intErr } = await supabase
    .from("fiscal_integrations")
    .select("id, restaurant_id, provider, config")
    .in("id", integrationIds);
  if (intErr) throw new Error(`fetch integrations: ${intErr.message}`);

  const byId = new Map<string, IntegrationRow>();
  for (const i of (ints as IntegrationRow[]) ?? []) byId.set(i.id, i);

  const errors: NormalizeResult["errors"] = [];
  let processed = 0;

  for (const ev of events as RawEventRow[]) {
    try {
      const integration = byId.get(ev.integration_id);
      if (!integration) throw new Error(`integration ${ev.integration_id} not found`);
      const adapter = getAdapter(integration.provider as Parameters<typeof getAdapter>[0]);
      const normalized = adapter.normalize(
        {
          external_id: ev.external_id,
          event_type: ev.event_type as "receipt.created" | "receipt.voided" | "receipt.refunded",
          payload: ev.payload,
        },
        integration,
      );
      if (!normalized) throw new Error("adapter.normalize returned null");

      await upsertReceipt(integration, normalized);
      await supabase
        .from("fiscal_raw_events")
        .update({ processed_at: new Date().toISOString(), process_error: null })
        .eq("id", ev.id);
      processed += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ id: ev.id, error: msg });
      await supabase
        .from("fiscal_raw_events")
        .update({ process_error: msg })
        .eq("id", ev.id);
    }
  }

  // Refresh aggregates once per batch
  if (processed > 0) {
    await supabase.rpc("refresh_fiscal_aggregates");
  }

  return { processed, errors };
}

async function upsertReceipt(integration: IntegrationRow, n: NormalizedReceipt): Promise<void> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("fiscal_receipts")
    .select("id")
    .eq("integration_id", integration.id)
    .eq("external_id", n.external_id)
    .maybeSingle();

  let receiptId: string;
  if (existing) {
    receiptId = (existing as { id: string }).id;
    const { error } = await supabase
      .from("fiscal_receipts")
      .update({
        issued_at: n.issued_at,
        business_day: n.business_day,
        status: n.status,
        subtotal_cents: n.subtotal_cents,
        vat_cents: n.vat_cents,
        total_cents: n.total_cents,
        payment_method: n.payment_method,
        operator_name: n.operator_name,
        table_ref: n.table_ref,
        covers: n.covers,
        metadata: n.metadata,
      })
      .eq("id", receiptId);
    if (error) throw new Error(`update receipt: ${error.message}`);
    await supabase.from("fiscal_receipt_items").delete().eq("receipt_id", receiptId);
  } else {
    const { data: inserted, error } = await supabase
      .from("fiscal_receipts")
      .insert({
        restaurant_id: integration.restaurant_id,
        integration_id: integration.id,
        external_id: n.external_id,
        issued_at: n.issued_at,
        business_day: n.business_day,
        status: n.status,
        subtotal_cents: n.subtotal_cents,
        vat_cents: n.vat_cents,
        total_cents: n.total_cents,
        payment_method: n.payment_method,
        operator_name: n.operator_name,
        table_ref: n.table_ref,
        covers: n.covers,
        metadata: n.metadata,
      })
      .select("id")
      .single();
    if (error) throw new Error(`insert receipt: ${error.message}`);
    receiptId = (inserted as { id: string }).id;
  }

  if (n.items.length > 0) {
    const { error } = await supabase.from("fiscal_receipt_items").insert(
      n.items.map((it) => ({
        receipt_id: receiptId,
        line_number: it.line_number,
        pos_item_id: it.pos_item_id,
        name: it.name,
        category: it.category,
        quantity: it.quantity,
        unit_price_cents: it.unit_price_cents,
        subtotal_cents: it.subtotal_cents,
        vat_rate: it.vat_rate,
        discount_cents: it.discount_cents,
        is_voided: it.is_voided,
      })),
    );
    if (error) throw new Error(`insert items: ${error.message}`);

    // Upsert fiscal_pos_items for any line with a pos_item_id
    const lineItems = n.items.filter((it): it is typeof it & { pos_item_id: string } => !!it.pos_item_id);
    for (const it of lineItems) {
      await supabase.from("fiscal_pos_items").upsert(
        {
          integration_id: integration.id,
          pos_item_id: it.pos_item_id,
          name: it.name,
          category: it.category,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "integration_id,pos_item_id" },
      );
    }
  }
}
```

- [ ] **Step 2: Test (pure-function test, does not hit DB)**

Because the normalizer touches DB, the unit test uses a mock supabase client. Node's `node:test` lacks a built-in mocking lib; we use a minimal hand-rolled mock. This tests the control flow, not the adapter normalize (covered elsewhere).

Skip DB integration test — it will run as part of the end-to-end smoke in Plan 3 (webhook route + edge fn tests). For now the module must just TypeCheck.

```bash
cd D:/Manum/GastroBridge && npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/fiscal/normalizer.ts
git commit -m "feat(fiscal): normalizer dispatches raw events to adapter + upserts

processUnprocessedEvents(limit=100) reads fiscal_raw_events WHERE
processed_at IS NULL, dispatches to the registered adapter's normalize,
upserts fiscal_receipts + items + pos_items, then refreshes aggregates
once per batch. Failures stamp process_error without blocking the
rest of the batch. Receipt re-sync replaces line items (void any
previous set)."
```

---

## Task 10: Final verification

- [ ] **Step 1: All fiscal tests pass**

```bash
cd D:/Manum/GastroBridge && \
  node --test --experimental-strip-types --experimental-transform-types \
    lib/fiscal/adapters/mock/index.test.ts \
    lib/fiscal/adapters/generic-webhook/index.test.ts \
    lib/fiscal/adapters/tilby/index.test.ts
```

Expected: 12 passed.

- [ ] **Step 2: Full TypeCheck clean**

```bash
cd D:/Manum/GastroBridge && npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Lint clean**

```bash
cd D:/Manum/GastroBridge && npx eslint lib/fiscal
```

Expected: 0 errors (warnings allowed if existing pattern). Fix critical issues.

- [ ] **Step 4: Update memory**

Edit `C:\Users\Manum\.claude\projects\D--Manum-GastroBridge\memory\project_cassetto_fiscale.md` and mark `[x] Plan 2 — Adapter framework + Tilby + mock + generic webhook`. Add any gotcha uncovered during exec.

---

## Notes for reviewers

- **Why no real Tilby API call in tests?** Tilby live API requires a dev account and test shop. Hitting it from CI or a subagent is out of scope. The test verifies the shape transformation and webhook signature math — the HTTP path is exercised manually in staging before go-live.
- **Why the TODO about endpoint URLs?** Tilby developer docs are behind a partner portal. Before enabling in prod, verify `TILBY_AUTH_URL`, `TILBY_TOKEN_URL`, `TILBY_API_BASE`, and the `GET /receipts` pagination contract.
- **Why no `pos_item_id` + gb_product_id auto-mapping?** Out of scope — Plan 5 (reorder) will add a manual mapping UI. For now `fiscal_pos_items` rows are created but not mapped.
- **Why a `getMockAdapter()` separate from registry?** Mock isn't a real `FiscalProvider` enum value — it's a test-only hook. Keeping it off the registry avoids accidentally exposing it to production code paths.
