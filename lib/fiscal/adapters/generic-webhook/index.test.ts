import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { genericWebhookAdapter } from "./index.ts";

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
  const ok = genericWebhookAdapter.verifyWebhook!({}, "{}", SECRET);
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
      {
        line_number: 1,
        name: "X",
        quantity: 1,
        unit_price_cents: 1000,
        subtotal_cents: 1000,
        vat_rate: 10,
      },
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
