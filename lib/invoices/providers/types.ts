// lib/invoices/providers/types.ts
// Adapter interface for accredited SDI intermediaries (receipt of passive
// invoices). One implementation per provider (Openapi.com today; Invoicetronic,
// A-Cube, Fatture in Cloud… can be added behind the same interface).
//
// Model: GastroBridge holds ONE account with the intermediary (credentials in
// env vars). Each restaurant's company (P.IVA) is registered under that
// account; suppliers' invoices reach the intermediary because the restaurant
// registers the intermediary's codice destinatario on the Agenzia delle
// Entrate portal; the intermediary then notifies our webhook.

export interface ProviderInvoiceRef {
  /** Provider identifier of the received invoice (uuid / IdentificativoSdI). */
  externalId: string;
  receivedAt: string | null;
  /** P.IVA / CF of the recipient company (cessionario). */
  recipientFiscalId: string | null;
}

export interface ProviderInvoiceDocument {
  externalId: string;
  fileName: string;
  recipientFiscalId: string | null;
  /** Raw file (XML or .p7m) when the provider serves it. */
  bytes?: Uint8Array;
  /** JSON rendering of the FatturaPA when no file is available. */
  json?: unknown;
}

export interface RegisterCompanyInput {
  fiscalId: string;
  companyName: string;
  email: string | null;
  webhookUrl: string;
  webhookAuthHeader: string;
}

export interface RegisterCompanyResult {
  recipientCode: string;
  providerRef: string | null;
  webhookConfigured: boolean;
}

export interface ParsedWebhook {
  kind: "supplier_invoice" | "other";
  event: string;
  externalId: string | null;
  recipientFiscalId: string | null;
  document: ProviderInvoiceDocument | null;
}

export interface ProviderStatus {
  configured: boolean;
  environment: "sandbox" | "production" | null;
  missing: string[];
}

export interface SdiProvider {
  id: string;
  label: string;
  status(): ProviderStatus;
  /** Codice destinatario the restaurant must register on the AdE portal. */
  recipientCode(): string | null;
  registerCompany(input: RegisterCompanyInput): Promise<RegisterCompanyResult>;
  /** Supplier invoices received since `since` for one company. */
  listSupplierInvoices(params: { fiscalId: string; since: Date }): AsyncIterable<ProviderInvoiceRef>;
  downloadInvoice(ref: ProviderInvoiceRef): Promise<ProviderInvoiceDocument>;
  /** Authenticate an inbound webhook call (constant-time compare). */
  verifyWebhook(headers: Headers, rawBody: string): Promise<boolean>;
  parseWebhook(body: unknown): ParsedWebhook;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
