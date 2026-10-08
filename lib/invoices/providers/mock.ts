// lib/invoices/providers/mock.ts
// No-network provider for development, previews and tests. Enabled with
// INVOICES_SDI_PROVIDER=mock. Registers instantly and "receives" nothing
// unless documents are injected with mockProviderInbox.push().

import type {
  ParsedWebhook,
  ProviderInvoiceDocument,
  ProviderInvoiceRef,
  ProviderStatus,
  RegisterCompanyInput,
  RegisterCompanyResult,
  SdiProvider,
} from "./types.ts";

export const mockProviderInbox: Array<ProviderInvoiceDocument & { receivedAt: string }> = [];

export const mockProvider: SdiProvider = {
  id: "mock",
  label: "Simulatore SDI (sviluppo)",
  status(): ProviderStatus {
    return { configured: true, environment: "sandbox", missing: [] };
  },
  recipientCode() {
    return "0000000";
  },
  async registerCompany(input: RegisterCompanyInput): Promise<RegisterCompanyResult> {
    return { recipientCode: "0000000", providerRef: `mock-${input.fiscalId}`, webhookConfigured: true };
  },
  async *listSupplierInvoices({ fiscalId, since }): AsyncIterable<ProviderInvoiceRef> {
    for (const d of mockProviderInbox) {
      if (d.recipientFiscalId && d.recipientFiscalId !== fiscalId) continue;
      if (Date.parse(d.receivedAt) < since.getTime()) continue;
      yield { externalId: d.externalId, receivedAt: d.receivedAt, recipientFiscalId: d.recipientFiscalId };
    }
  },
  async downloadInvoice(ref: ProviderInvoiceRef): Promise<ProviderInvoiceDocument> {
    const d = mockProviderInbox.find((x) => x.externalId === ref.externalId);
    if (!d) throw new Error("documento simulato non trovato");
    return d;
  },
  async verifyWebhook(headers: Headers): Promise<boolean> {
    // Never accepted in production builds.
    return process.env.NODE_ENV !== "production" && headers.get("authorization") === "Bearer mock";
  },
  parseWebhook(body: unknown): ParsedWebhook {
    const b = (body ?? {}) as { event?: string; externalId?: string; recipientFiscalId?: string; json?: unknown };
    return {
      kind: b.event === "supplier-invoice" ? "supplier_invoice" : "other",
      event: b.event ?? "unknown",
      externalId: b.externalId ?? null,
      recipientFiscalId: b.recipientFiscalId ?? null,
      document: b.externalId
        ? { externalId: b.externalId, fileName: `${b.externalId}.json`, recipientFiscalId: b.recipientFiscalId ?? null, json: b.json }
        : null,
    };
  },
};
