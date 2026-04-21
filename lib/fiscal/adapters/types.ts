// lib/fiscal/adapters/types.ts
import { z } from "zod/v4";
import type {
  Credentials,
  FetchWindow,
  FiscalIntegrationRow,
  FiscalProvider,
  NormalizedReceipt,
  ProviderConfig,
  ReceiptEvent,
} from "../types";

export interface RawPosItem {
  pos_item_id: string;
  name: string;
  category?: string | null;
  last_seen_at?: string;
}

export interface PosAdapter {
  readonly provider: FiscalProvider;

  // OAuth2 flow (optional — API-key providers skip)
  getAuthUrl?(state: string, redirectUri: string): string;
  exchangeCode?(code: string, redirectUri: string): Promise<Credentials>;
  refreshCredentials?(creds: Credentials): Promise<Credentials>;

  // Data pull
  fetchReceipts(
    creds: Credentials,
    config: ProviderConfig,
    window: FetchWindow,
  ): AsyncIterable<ReceiptEvent>;

  fetchCatalog?(
    creds: Credentials,
    config: ProviderConfig,
  ): AsyncIterable<RawPosItem>;

  // Webhook (optional)
  verifyWebhook?(
    headers: Record<string, string>,
    body: string,
    secret: string,
  ): boolean;
  parseWebhook?(body: string): ReceiptEvent[];

  // Pure transform — takes raw payload, returns normalized receipt.
  normalize(
    rawEvent: ReceiptEvent,
    integration: Pick<FiscalIntegrationRow, "id" | "restaurant_id" | "config">,
  ): NormalizedReceipt | null;
}

// Zod schema reused when parsing events from untrusted sources.
export const receiptEventSchema = z.object({
  external_id: z.string().min(1),
  event_type: z.enum(["receipt.created", "receipt.voided", "receipt.refunded"]),
  payload: z.unknown(),
});

export type ReceiptEventSchema = z.infer<typeof receiptEventSchema>;
