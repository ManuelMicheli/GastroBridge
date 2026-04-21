import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { sclobyAdapter } from "./index.ts";

const SECRET = "scloby-secret-xyz";

const sample = {
  id: "sc-001",
  number: "2026-000333",
  datetime: "2026-04-21T20:00:00+02:00",
  status: "issued" as const,
  subtotal: 30.0,
  vat_amount: 3.0,
  total: 33.0,
  payment: "cash",
  cashier: "Andrea",
  covers: 2,
  table: "Bar-2",
  items: [
    { id: 701, name: "Americano", qty: 2, price: 7.0, vat: 10, department: "Cocktail" },
    { id: 702, name: "Stuzzichini", qty: 1, price: 16.0, vat: 10 },
  ],
};

test("scloby.verifyWebhook accepts valid signature", () => {
  const body = JSON.stringify({ event: "receipt.created", receipt: sample });
  const sig = createHmac("sha256", SECRET).update(body).digest("hex");
  assert.equal(
    sclobyAdapter.verifyWebhook!(
      { "x-scloby-signature": sig },
      body,
      SECRET,
    ),
    true,
  );
});

test("scloby.verifyWebhook rejects invalid signature", () => {
  const body = JSON.stringify({ event: "receipt.created", receipt: sample });
  assert.equal(
    sclobyAdapter.verifyWebhook!(
      { "x-scloby-signature": "00".repeat(32) },
      body,
      SECRET,
    ),
    false,
  );
});

test("scloby.parseWebhook unwraps wrapper", () => {
  const body = JSON.stringify({ event: "receipt.created", receipt: sample });
  const events = sclobyAdapter.parseWebhook!(body);
  assert.equal(events.length, 1);
  assert.equal(events[0]!.external_id, "sc-001");
  assert.equal(events[0]!.event_type, "receipt.created");
});

test("scloby.normalize converts payload", () => {
  const events = sclobyAdapter.parseWebhook!(
    JSON.stringify({ event: "receipt.created", receipt: sample }),
  );
  const out = sclobyAdapter.normalize(events[0]!, {
    id: "i1",
    restaurant_id: "r1",
    config: {},
  })!;
  assert.equal(out.external_id, "sc-001");
  assert.equal(out.subtotal_cents, 3000);
  assert.equal(out.vat_cents, 300);
  assert.equal(out.total_cents, 3300);
  // Americano 2 × 700 = 1400
  assert.equal(out.items[0]!.subtotal_cents, 1400);
  // Stuzzichini 1 × 1600 = 1600
  assert.equal(out.items[1]!.subtotal_cents, 1600);
  assert.equal(out.table_ref, "Bar-2");
});

test("scloby.normalize marks voided", () => {
  const body = JSON.stringify({
    event: "receipt.voided",
    receipt: { ...sample, status: "voided" as const },
  });
  const [ev] = sclobyAdapter.parseWebhook!(body);
  const out = sclobyAdapter.normalize(ev!, {
    id: "i1",
    restaurant_id: "r1",
    config: {},
  })!;
  assert.equal(out.status, "voided");
});
