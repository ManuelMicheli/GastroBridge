import { test } from "node:test";
import assert from "node:assert/strict";
import { allocateFefo } from "./fefo";
import type { LotCandidate } from "./types";

function lot(partial: Partial<LotCandidate> & { id: string }): LotCandidate {
  return {
    productId: "p",
    warehouseId: "w",
    lotCode: partial.id.toUpperCase(),
    expiryDate: null,
    receivedAt: "2026-04-01T00:00:00Z",
    quantityBase: 10,
    quantityReservedBase: 0,
    ...partial,
  };
}

test("singolo lotto copre tutta la richiesta", () => {
  const result = allocateFefo(
    [lot({ id: "a", expiryDate: "2026-06-01", quantityBase: 10 })],
    7,
  );
  assert.deepEqual(result, {
    ok: true,
    allocations: [{ lotId: "a", quantityBase: 7 }],
  });
});

test("alloca dal lotto con scadenza piu vicina anche se quantita maggiore altrove", () => {
  const result = allocateFefo(
    [
      lot({
        id: "a",
        expiryDate: "2026-06-01",
        receivedAt: "2026-04-01T00:00:00Z",
        quantityBase: 100,
      }),
      lot({
        id: "b",
        expiryDate: "2026-05-01",
        receivedAt: "2026-04-02T00:00:00Z",
        quantityBase: 5,
      }),
    ],
    4,
  );
  assert.deepEqual(result, {
    ok: true,
    allocations: [{ lotId: "b", quantityBase: 4 }],
  });
});

test("due lotti con stessa scadenza: tiebreak FIFO su receivedAt", () => {
  const result = allocateFefo(
    [
      lot({
        id: "new",
        expiryDate: "2026-06-01",
        receivedAt: "2026-04-05T00:00:00Z",
        quantityBase: 10,
      }),
      lot({
        id: "old",
        expiryDate: "2026-06-01",
        receivedAt: "2026-04-01T00:00:00Z",
        quantityBase: 10,
      }),
    ],
    3,
  );
  assert.deepEqual(result, {
    ok: true,
    allocations: [{ lotId: "old", quantityBase: 3 }],
  });
});

test("multi-lotto: richiesta > singolo lotto ma totale sufficiente", () => {
  const result = allocateFefo(
    [
      lot({ id: "a", expiryDate: "2026-05-01", quantityBase: 5 }),
      lot({ id: "b", expiryDate: "2026-06-01", quantityBase: 5 }),
      lot({ id: "c", expiryDate: "2026-07-01", quantityBase: 10 }),
    ],
    12,
  );
  assert.deepEqual(result, {
    ok: true,
    allocations: [
      { lotId: "a", quantityBase: 5 },
      { lotId: "b", quantityBase: 5 },
      { lotId: "c", quantityBase: 2 },
    ],
  });
});

test("stock insufficiente: ok=false con shortBy e allocazioni parziali", () => {
  const result = allocateFefo(
    [
      lot({ id: "a", expiryDate: "2026-05-01", quantityBase: 3 }),
      lot({ id: "b", expiryDate: "2026-06-01", quantityBase: 4 }),
    ],
    10,
  );
  assert.deepEqual(result, {
    ok: false,
    reason: "insufficient_stock",
    shortBy: 3,
    allocations: [
      { lotId: "a", quantityBase: 3 },
      { lotId: "b", quantityBase: 4 },
    ],
  });
});

test("lotto con expiryDate=null (non deperibile) va in coda", () => {
  const result = allocateFefo(
    [
      lot({
        id: "ndep",
        expiryDate: null,
        receivedAt: "2026-01-01T00:00:00Z",
        quantityBase: 100,
      }),
      lot({
        id: "dep",
        expiryDate: "2027-01-01",
        receivedAt: "2026-04-01T00:00:00Z",
        quantityBase: 5,
      }),
    ],
    6,
  );
  assert.deepEqual(result, {
    ok: true,
    allocations: [
      { lotId: "dep", quantityBase: 5 },
      { lotId: "ndep", quantityBase: 1 },
    ],
  });
});

test("requestedBase=0 restituisce allocazioni vuote senza toccare lotti", () => {
  const result = allocateFefo(
    [lot({ id: "a", expiryDate: "2026-05-01", quantityBase: 10 })],
    0,
  );
  assert.deepEqual(result, { ok: true, allocations: [] });
});

test("quantityReservedBase riduce il disponibile del lotto", () => {
  const result = allocateFefo(
    [
      lot({
        id: "a",
        expiryDate: "2026-05-01",
        quantityBase: 10,
        quantityReservedBase: 7,
      }),
      lot({
        id: "b",
        expiryDate: "2026-06-01",
        quantityBase: 10,
        quantityReservedBase: 0,
      }),
    ],
    5,
  );
  // available(a) = 3 → consumo tutto a, poi 2 da b
  assert.deepEqual(result, {
    ok: true,
    allocations: [
      { lotId: "a", quantityBase: 3 },
      { lotId: "b", quantityBase: 2 },
    ],
  });
});

test("lotti con quantityReservedBase >= quantityBase vengono esclusi", () => {
  const result = allocateFefo(
    [
      lot({
        id: "full",
        expiryDate: "2026-05-01",
        quantityBase: 10,
        quantityReservedBase: 10,
      }),
      lot({
        id: "free",
        expiryDate: "2026-06-01",
        quantityBase: 5,
      }),
    ],
    4,
  );
  assert.deepEqual(result, {
    ok: true,
    allocations: [{ lotId: "free", quantityBase: 4 }],
  });
});

test("stock zero totale: ok=false con shortBy pari al richiesto", () => {
  const result = allocateFefo([], 5);
  assert.deepEqual(result, {
    ok: false,
    reason: "insufficient_stock",
    shortBy: 5,
    allocations: [],
  });
});

test("requestedBase negativo lancia errore", () => {
  assert.throws(() => allocateFefo([], -1), /non-negative/);
});
