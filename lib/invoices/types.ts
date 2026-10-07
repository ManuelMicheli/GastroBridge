// lib/invoices/types.ts
// Shared types of the supplier e-invoice module (pure, no runtime deps).

export interface InvoiceAddress {
  street: string | null;
  number: string | null;
  zip: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
}

export interface InvoiceParty {
  vatCountry: string | null;
  /** P.IVA digits (IdCodice), without the country prefix. */
  vatNumber: string | null;
  taxCode: string | null;
  name: string | null;
  address: InvoiceAddress | null;
  email: string | null;
  phone: string | null;
  regime: string | null;
}

export type InvoiceLineKind = "goods" | "discount" | "premium" | "allowance" | "accessory" | "note";

export interface LineDiscount {
  /** SC = sconto, MG = maggiorazione. */
  type: "SC" | "MG";
  percent: number | null;
  amount: number | null;
}

export interface ItemCode {
  type: string;
  value: string;
}

export interface ParsedInvoiceLine {
  lineNumber: number;
  kind: InvoiceLineKind;
  /** Raw TipoCessionePrestazione (SC/PR/AB/AC) or null. */
  saleType: string | null;
  itemCodes: ItemCode[];
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number;
  discounts: LineDiscount[];
  /** PrezzoTotale (taxable, after line discounts). */
  totalPrice: number;
  vatRate: number;
  natura: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  otherData: Array<{ type: string | null; text: string | null; number: number | null; date: string | null }>;
}

export interface DocumentRef {
  id: string | null;
  date: string | null;
  lineNumbers: number[];
}

export interface DdtRef {
  number: string;
  date: string | null;
  /** RiferimentoNumeroLinea: invoice lines covered by this DDT (empty = all). */
  lineNumbers: number[];
}

export interface VatSummary {
  rate: number;
  natura: string | null;
  taxable: number;
  tax: number;
  accessoryCharges: number | null;
  rounding: number | null;
  esigibilita: string | null;
  normRef: string | null;
}

export interface PaymentInstallment {
  conditions: string | null;
  method: string | null;
  dueDate: string | null;
  amount: number | null;
  iban: string | null;
  beneficiary: string | null;
  bank: string | null;
}

export interface InvoiceAttachmentInfo {
  name: string | null;
  format: string | null;
  description: string | null;
  sizeBytes: number;
}

export interface ParsedInvoice {
  /** Position of the FatturaElettronicaBody inside the file (0-based). */
  bodyIndex: number;
  formatVersion: string | null;
  simplified: boolean;
  transmission: {
    senderId: string | null;
    progressive: string | null;
    recipientCode: string | null;
    recipientPec: string | null;
  };
  supplier: InvoiceParty;
  buyer: InvoiceParty;
  documentType: string;
  currency: string;
  date: string | null;
  number: string;
  totalAmount: number | null;
  rounding: number | null;
  stampDuty: number | null;
  causale: string[];
  globalDiscounts: LineDiscount[];
  orderRefs: DocumentRef[];
  linkedInvoices: DocumentRef[];
  ddt: DdtRef[];
  lines: ParsedInvoiceLine[];
  vatSummaries: VatSummary[];
  payments: PaymentInstallment[];
  attachments: InvoiceAttachmentInfo[];
  totals: {
    /** Σ DatiRiepilogo.ImponibileImporto (falls back to Σ lines). */
    taxable: number;
    /** Σ DatiRiepilogo.Imposta. */
    vat: number;
    /** ImportoTotaleDocumento, or taxable + vat (+ bollo) when missing. */
    gross: number;
    linesTotal: number;
  };
  warnings: string[];
}

export interface ParseResult {
  invoices: ParsedInvoice[];
  errors: string[];
}

/* ------------------------------------------------------------------ */
/* Reconciliation                                                       */
/* ------------------------------------------------------------------ */

export type InvoiceStatus = "da_verificare" | "ok" | "anomalie" | "contestata" | "risolta";

export type FindingKind =
  | "price_above_agreed"
  | "qty_above_received"
  | "qty_above_ordered"
  | "not_ordered"
  | "duplicate_invoice"
  | "possible_duplicate"
  | "vat_anomaly"
  | "total_mismatch"
  | "missing_credit_note"
  | "no_order_found"
  | "unknown_supplier";

export type FindingSeverity = "low" | "medium" | "high";

export type FindingStatus = "open" | "disputed" | "resolved" | "dismissed";

export interface Finding {
  kind: FindingKind;
  severity: FindingSeverity;
  /** € impact in cents (≥ 0). For VAT anomalies it is the VAT difference. */
  impactCents: number;
  /** Counts towards "soldi da recuperare" (false for VAT / informational). */
  recoverable: boolean;
  /** Invoice line number, when the finding is about one line. */
  lineNumber: number | null;
  title: string;
  message: string;
  details: Record<string, unknown>;
}
