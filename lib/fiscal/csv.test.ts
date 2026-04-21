import { test } from "node:test";
import assert from "node:assert/strict";
import {
  autoDetectMapping,
  buildReceiptsFromCsv,
  parseCsvPreview,
} from "./csv.ts";

const SAMPLE = `receipt_external_id,issued_at,line_number,item_name,quantity,unit_price,vat_rate,payment_method,covers
R-1,2026-04-21T12:00:00+02:00,1,Tagliata,1,22.00,10,card,2
R-1,2026-04-21T12:00:00+02:00,2,Calice Chianti,2,8.00,10,,
R-2,2026-04-21T13:00:00+02:00,1,Margherita,2,9.00,10,cash,2
`;

test("autoDetectMapping recognizes English headers", () => {
  const { mapping, missing } = autoDetectMapping([
    "receipt_external_id",
    "issued_at",
    "line_number",
    "item_name",
    "quantity",
    "unit_price",
  ]);
  assert.equal(missing.length, 0);
  assert.ok(mapping);
  assert.equal(mapping!.item_name, "item_name");
});

test("autoDetectMapping recognizes Italian headers", () => {
  const { mapping, missing } = autoDetectMapping([
    "scontrino_id",
    "data_ora",
    "riga",
    "nome",
    "qta",
    "prezzo_unitario",
  ]);
  assert.equal(missing.length, 0);
  assert.ok(mapping);
  assert.equal(mapping!.receipt_external_id, "scontrino_id");
  assert.equal(mapping!.issued_at, "data_ora");
  assert.equal(mapping!.item_name, "nome");
});

test("parseCsvPreview returns headers + rows + auto mapping", () => {
  const preview = parseCsvPreview(SAMPLE);
  assert.equal(preview.rowCount, 3);
  assert.ok(preview.autoMapping);
  assert.equal(preview.headers.length, 9);
  assert.equal(preview.autoMapping!.payment_method, "payment_method");
});

test("buildReceiptsFromCsv groups by external_id, derives VAT", () => {
  const preview = parseCsvPreview(SAMPLE);
  const { receipts, errors } = buildReceiptsFromCsv(
    SAMPLE,
    preview.autoMapping!,
  );
  assert.equal(errors.length, 0);
  assert.equal(receipts.length, 2);
  const r1 = receipts.find((r) => r.external_id === "R-1")!;
  assert.equal(r1.items.length, 2);
  // 22 + 16 = 38€ subtotal
  assert.equal(r1.subtotal_cents, 3800);
  // 10% VAT = 380
  assert.equal(r1.vat_cents, 380);
  assert.equal(r1.total_cents, 4180);
  assert.equal(r1.payment_method, "card");
  assert.equal(r1.covers, 2);
  assert.equal(r1.business_day, "2026-04-21");
});

test("buildReceiptsFromCsv rejects rows missing required fields", () => {
  const broken = `receipt_external_id,issued_at,line_number,item_name,quantity,unit_price
,2026-04-21T12:00:00Z,1,X,1,10
R-1,,1,Y,1,10
R-1,2026-04-21T12:00:00Z,1,Z,-1,10
`;
  const preview = parseCsvPreview(broken);
  const { receipts, errors } = buildReceiptsFromCsv(
    broken,
    preview.autoMapping!,
  );
  assert.equal(receipts.length, 0);
  assert.equal(errors.length, 3);
});
