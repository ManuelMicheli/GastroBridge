import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { tilbyAdapter } from "./index.ts";

const WEBHOOK_SECRET = "tilby-secret-123";

const sampleReceipt = {
  id: "tlb-001",
  receipt_number: "2026-000123",
  sell_datetime: "2026-04-21T12:30:00+02:00",
  status: "issued" as const,
  subtotal: 38.0,
  vat_total: 3.8,
  total: 41.8,
  payment_method: "card",
  operator_name: "Luca",
  customer_count: 2,
  table_name: "T4",
  items: [
    {
      id: 101,
      name: "Tagliata",
      quantity: 1,
      price: 22.0,
      vat_percentage: 10,
      category_name: "Carni",
    },
    {
      id: 102,
      name: "Calice Chianti",
      quantity: 2,
      price: 8.0,
      vat_percentage: 10,
    },
  ],
};

test("tilby.verifyWebhook accepts valid signature", () => {
  const body = JSON.stringify({
    event: "receipt.created",
    receipt: sampleReceipt,
  });
  const sig = createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
  assert.equal(
    tilbyAdapter.verifyWebhook!(
      { "x-tilby-signature": sig },
      body,
      WEBHOOK_SECRET,
    ),
    true,
  );
});

test("tilby.verifyWebhook rejects invalid signature", () => {
  const body = JSON.stringify({
    event: "receipt.created",
    receipt: sampleReceipt,
  });
  assert.equal(
    tilbyAdapter.verifyWebhook!(
      { "x-tilby-signature": "00".repeat(32) },
      body,
      WEBHOOK_SECRET,
    ),
    false,
  );
});

test("tilby.parseWebhook unwraps wrapper", () => {
  const body = JSON.stringify({
    event: "receipt.created",
    receipt: sampleReceipt,
  });
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
  const out = tilbyAdapter.normalize(ev!, {
    id: "i1",
    restaurant_id: "r1",
    config: {},
  })!;
  assert.equal(out.status, "refunded");
});
