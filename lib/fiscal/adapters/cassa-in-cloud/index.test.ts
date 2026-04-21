import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { cassaInCloudAdapter } from "./index.ts";

const SECRET = "cic-secret-xyz";

const sample = {
  id: "cic-001",
  documentNumber: "2026-000777",
  date: "2026-04-21T19:30:00+02:00",
  status: "ISSUED" as const,
  subtotal: 50.0,
  vatTotal: 5.0,
  total: 55.0,
  paymentType: "card",
  operatorName: "Giulia",
  covers: 3,
  tableName: "T12",
  items: [
    {
      id: 301,
      description: "Fritto misto",
      quantity: 1,
      price: 28.0,
      vatRate: 10,
      departmentName: "Pesce",
    },
    { id: 302, description: "Sauvignon", quantity: 2, price: 11.0, vatRate: 10 },
  ],
};

test("cassa_in_cloud.verifyWebhook accepts valid signature", () => {
  const body = JSON.stringify({ eventType: "receipt.created", data: sample });
  const sig = createHmac("sha256", SECRET).update(body).digest("hex");
  assert.equal(
    cassaInCloudAdapter.verifyWebhook!(
      { "x-cic-signature": sig },
      body,
      SECRET,
    ),
    true,
  );
});

test("cassa_in_cloud.verifyWebhook rejects invalid signature", () => {
  const body = JSON.stringify({ eventType: "receipt.created", data: sample });
  assert.equal(
    cassaInCloudAdapter.verifyWebhook!(
      { "x-cic-signature": "00".repeat(32) },
      body,
      SECRET,
    ),
    false,
  );
});

test("cassa_in_cloud.parseWebhook unwraps wrapper", () => {
  const body = JSON.stringify({ eventType: "receipt.created", data: sample });
  const events = cassaInCloudAdapter.parseWebhook!(body);
  assert.equal(events.length, 1);
  assert.equal(events[0]!.external_id, "cic-001");
  assert.equal(events[0]!.event_type, "receipt.created");
});

test("cassa_in_cloud.normalize converts payload", () => {
  const events = cassaInCloudAdapter.parseWebhook!(
    JSON.stringify({ eventType: "receipt.created", data: sample }),
  );
  const out = cassaInCloudAdapter.normalize(events[0]!, {
    id: "i1",
    restaurant_id: "r1",
    config: {},
  })!;
  assert.equal(out.external_id, "cic-001");
  assert.equal(out.subtotal_cents, 5000);
  assert.equal(out.vat_cents, 500);
  assert.equal(out.total_cents, 5500);
  assert.equal(out.items.length, 2);
  // Fritto: 1 × 2800 = 2800
  assert.equal(out.items[0]!.subtotal_cents, 2800);
  // Sauvignon: 2 × 1100 = 2200
  assert.equal(out.items[1]!.subtotal_cents, 2200);
  assert.equal(out.covers, 3);
  assert.equal(out.table_ref, "T12");
});

test("cassa_in_cloud.normalize marks cancelled as voided", () => {
  const body = JSON.stringify({
    eventType: "receipt.cancelled",
    data: { ...sample, status: "CANCELLED" as const },
  });
  const [ev] = cassaInCloudAdapter.parseWebhook!(body);
  const out = cassaInCloudAdapter.normalize(ev!, {
    id: "i1",
    restaurant_id: "r1",
    config: {},
  })!;
  assert.equal(out.status, "voided");
});
