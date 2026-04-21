// lib/fiscal/adapters/mock/fixtures.ts
import type { ReceiptEvent } from "../../types.ts";

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
