// lib/fiscal/types.ts
// Shared types for the Cassetto Fiscale module.

import type {
  Database,
  FiscalProvider,
  FiscalIntegrationStatus,
  FiscalReceiptStatus,
} from "@/types/database";

type Tbl<K extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][K]["Row"];

export type FiscalIntegrationRow = Tbl<"fiscal_integrations">;
export type FiscalReceiptRow = Tbl<"fiscal_receipts">;
export type FiscalReceiptItemRow = Tbl<"fiscal_receipt_items">;
export type FiscalPosItemRow = Tbl<"fiscal_pos_items">;

export interface OAuthCredentials {
  kind: "oauth2";
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  scope?: string;
}

export interface ApiKeyCredentials {
  kind: "api_key";
  api_key: string;
  shop_id?: string;
}

export type Credentials = OAuthCredentials | ApiKeyCredentials;

export interface NormalizedReceiptItem {
  line_number: number;
  pos_item_id: string | null;
  name: string;
  category: string | null;
  quantity: number;
  unit_price_cents: number;
  subtotal_cents: number;
  vat_rate: number | null;
  discount_cents: number;
  is_voided: boolean;
}

export interface NormalizedReceipt {
  external_id: string;
  issued_at: string;
  business_day: string;
  status: FiscalReceiptStatus;
  subtotal_cents: number;
  vat_cents: number;
  total_cents: number;
  payment_method: string | null;
  operator_name: string | null;
  table_ref: string | null;
  covers: number | null;
  metadata: Record<string, unknown>;
  items: NormalizedReceiptItem[];
}

export interface ProviderConfig {
  [key: string]: unknown;
  device_id?: string;
  shop_id?: string;
  timezone?: string;
}

export interface FetchWindow {
  since: Date;
  until?: Date;
}

export interface ReceiptEvent {
  external_id: string;
  event_type: "receipt.created" | "receipt.voided" | "receipt.refunded";
  payload: unknown;
}

export type { FiscalProvider, FiscalIntegrationStatus, FiscalReceiptStatus };
