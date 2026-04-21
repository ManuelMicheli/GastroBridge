import { test } from "node:test";
import assert from "node:assert/strict";
import { mockAdapter } from "./index.ts";
import { mockReceiptEvents } from "./fixtures.ts";

test("mockAdapter.fetchReceipts yields all fixture events", async () => {
  const out: string[] = [];
  for await (const ev of mockAdapter.fetchReceipts(
    { kind: "api_key", api_key: "x" },
    {},
    { since: new Date(0) },
  )) {
    out.push(ev.external_id);
  }
  assert.deepEqual(
    out,
    mockReceiptEvents.map((e) => e.external_id),
  );
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
  assert.equal(normalized.subtotal_cents, 3800);
  assert.equal(normalized.vat_cents, 380);
  assert.equal(normalized.total_cents, 4180);
  assert.equal(normalized.payment_method, "card");
  assert.equal(normalized.covers, 2);
  assert.equal(normalized.business_day, "2026-04-21");
});

test("mockAdapter.normalize marks voided event correctly", () => {
  const base = mockReceiptEvents[0]!;
  const evt = { ...base, event_type: "receipt.voided" as const };
  const integration = {
    id: "00000000-0000-0000-0000-000000000001",
    restaurant_id: "00000000-0000-0000-0000-000000000002",
    config: {},
  };
  const out = mockAdapter.normalize(evt, integration)!;
  assert.equal(out.status, "voided");
});
