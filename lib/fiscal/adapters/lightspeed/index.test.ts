import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { lightspeedAdapter } from "./index.ts";

const SECRET = "ls-secret-xyz";

const sample = {
  uuid: "ls-001",
  receiptNumber: "R-2026-555",
  closedAt: "2026-04-21T21:10:00+02:00",
  status: "CLOSED" as const,
  subtotalExTax: 45.0,
  taxTotal: 4.5,
  total: 49.5,
  paymentMethod: "card",
  cashierName: "Sara",
  guestCount: 2,
  tableNumber: "B4",
  items: [
    {
      id: 501,
      name: "Risotto zafferano",
      quantity: 2,
      unitPrice: 18.0,
      taxRate: 10,
      categoryName: "Primi",
    },
    { id: 502, name: "Acqua", quantity: 1, unitPrice: 9.0, taxRate: 10 },
  ],
};

test("lightspeed.verifyWebhook accepts valid signature", () => {
  const body = JSON.stringify({ event: "receipt.closed", payload: sample });
  const sig = createHmac("sha256", SECRET).update(body).digest("hex");
  assert.equal(
    lightspeedAdapter.verifyWebhook!(
      { "x-lightspeed-signature": sig },
      body,
      SECRET,
    ),
    true,
  );
});

test("lightspeed.verifyWebhook rejects invalid signature", () => {
  const body = JSON.stringify({ event: "receipt.closed", payload: sample });
  assert.equal(
    lightspeedAdapter.verifyWebhook!(
      { "x-lightspeed-signature": "00".repeat(32) },
      body,
      SECRET,
    ),
    false,
  );
});

test("lightspeed.parseWebhook unwraps wrapper", () => {
  const body = JSON.stringify({ event: "receipt.closed", payload: sample });
  const events = lightspeedAdapter.parseWebhook!(body);
  assert.equal(events.length, 1);
  assert.equal(events[0]!.external_id, "ls-001");
  assert.equal(events[0]!.event_type, "receipt.created");
});

test("lightspeed.normalize converts payload", () => {
  const events = lightspeedAdapter.parseWebhook!(
    JSON.stringify({ event: "receipt.closed", payload: sample }),
  );
  const out = lightspeedAdapter.normalize(events[0]!, {
    id: "i1",
    restaurant_id: "r1",
    config: {},
  })!;
  assert.equal(out.external_id, "ls-001");
  assert.equal(out.subtotal_cents, 4500);
  assert.equal(out.vat_cents, 450);
  assert.equal(out.total_cents, 4950);
  // Risotto 2 × 1800 = 3600
  assert.equal(out.items[0]!.subtotal_cents, 3600);
  // Acqua 1 × 900 = 900
  assert.equal(out.items[1]!.subtotal_cents, 900);
  assert.equal(out.table_ref, "B4");
  assert.equal(out.covers, 2);
});

test("lightspeed.normalize marks refunded status", () => {
  const body = JSON.stringify({
    event: "receipt.refunded",
    payload: { ...sample, status: "REFUNDED" as const },
  });
  const [ev] = lightspeedAdapter.parseWebhook!(body);
  const out = lightspeedAdapter.normalize(ev!, {
    id: "i1",
    restaurant_id: "r1",
    config: {},
  })!;
  assert.equal(out.status, "refunded");
});
