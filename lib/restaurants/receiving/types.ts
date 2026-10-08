import type { MacroCategory } from "@/lib/analytics/category-keywords";

export type DeliveryIssue = "ok" | "missing" | "short" | "damaged" | "wrong_item" | "quality";

export const ISSUE_LABELS: Record<DeliveryIssue, string> = {
  ok: "OK",
  missing: "Mancante",
  short: "Quantità diversa",
  damaged: "Danneggiato",
  wrong_item: "Prodotto errato",
  quality: "Qualità",
};

export const ISSUE_ORDER: DeliveryIssue[] = ["missing", "short", "damaged", "wrong_item", "quality"];

/** One line to check, built server-side from the order. */
export type ReceivingLine = {
  /** order_items.id (marketplace) or "catalog:<block>:<line>". */
  ref: string;
  name: string;
  unit: string | null;
  orderedQty: number | null;
  category: MacroCategory;
};

export type ReceivingBlock = {
  key: string;
  splitId: string | null;
  supplierLabel: string;
  /** Platform supplier on the chat: a dispute message can be sent. */
  canMessage: boolean;
  lines: ReceivingLine[];
};

/** Latest check-in outcome of an order line (order detail badges). */
export type LineCheckMark = {
  issue: DeliveryIssue;
  receivedQty: number | null;
  lotNumber: string | null;
  temperatureOk: boolean | null;
};

export type LastCheck = {
  checkedAt: string;
  supplierLabel: string | null;
  outcome: "ok" | "issues";
  issueCount: number;
  messageSent: boolean;
};
