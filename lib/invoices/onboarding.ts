// lib/invoices/onboarding.ts
// Copy and status of the "Collega le fatture elettroniche" wizard (pure).

export interface SupplierNoticeInput {
  companyName: string;
  fiscalId: string;
  recipientCode: string;
  /** Restaurant / brand name used to sign, when different. */
  signature?: string | null;
}

/** Short text for WhatsApp (also fine for SMS). */
export function supplierNoticeWhatsApp(i: SupplierNoticeInput): string {
  return [
    `Buongiorno! Da oggi riceviamo le fatture elettroniche con un nuovo codice destinatario.`,
    ``,
    `Intestatario: ${i.companyName}`,
    `P.IVA: ${i.fiscalId}`,
    `Codice destinatario (SDI): ${i.recipientCode}`,
    ``,
    `Vi chiediamo di aggiornarlo nella vostra anagrafica clienti e di indicare sempre in fattura il numero del DDT. Grazie!`,
    i.signature?.trim() || i.companyName,
  ].join("\n");
}

export function supplierNoticeEmailSubject(i: SupplierNoticeInput): string {
  return `Nuovo codice destinatario per le fatture – ${i.companyName}`;
}

export function supplierNoticeEmail(i: SupplierNoticeInput): string {
  return [
    `Gentile fornitore,`,
    ``,
    `vi informiamo che da oggi riceviamo le fatture elettroniche tramite un nuovo codice destinatario. Vi chiediamo cortesemente di aggiornare la nostra anagrafica:`,
    ``,
    `• Ragione sociale: ${i.companyName}`,
    `• Partita IVA: ${i.fiscalId}`,
    `• Codice destinatario (SDI): ${i.recipientCode}`,
    ``,
    `Per agevolare i controlli, vi preghiamo di indicare sempre in fattura il numero e la data del DDT di consegna.`,
    ``,
    `Grazie per la collaborazione e buon lavoro,`,
    i.signature?.trim() || i.companyName,
  ].join("\n");
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function mailtoUrl(subject: string, body: string, to = ""): string {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Agenzia delle Entrate portal steps (registrazione indirizzo telematico). */
export function portalSteps(recipientCode: string): Array<{ title: string; body: string }> {
  return [
    {
      title: "Entra in Fatture e Corrispettivi",
      body:
        "Vai su ivaservizi.agenziaentrate.gov.it e accedi con SPID, CIE o CNS del legale rappresentante (o di chi ha la delega). Scegli di operare per conto della tua azienda.",
    },
    {
      title: "Apri «Registrazione dell'indirizzo telematico»",
      body:
        "Nella sezione Fatturazione elettronica clicca «Registrazione dell'indirizzo telematico dove ricevere tutte le fatture elettroniche», poi scegli «Codice destinatario».",
    },
    {
      title: `Inserisci ${recipientCode} e conferma`,
      body:
        "Scrivi il codice, premi Conferma e salva la ricevuta. Da quel momento tutte le fatture dei tuoi fornitori arrivano anche qui, in automatico, qualunque codice abbiano usato.",
    },
  ];
}

export type ConnectionPhase = "inactive" | "not_connected" | "error" | "waiting" | "connected";

export interface ConnectionStatusInput {
  providerConfigured: boolean;
  status: "pending" | "active" | "error" | "disabled" | null;
  lastInvoiceAt: string | null;
  lastError: string | null;
}

const DAY = 86_400_000;

/** "oggi" / "ieri" / "3 giorni fa" / "il 12/09/2026". */
export function relativeDayIt(iso: string, now = new Date()): string {
  const toDay = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const then = new Date(iso);
  const diff = Math.round((toDay(now) - toDay(then)) / DAY);
  if (diff <= 0) return "oggi";
  if (diff === 1) return "ieri";
  if (diff < 7) return `${diff} giorni fa`;
  const dd = String(then.getDate()).padStart(2, "0");
  const mm = String(then.getMonth() + 1).padStart(2, "0");
  return `il ${dd}/${mm}/${then.getFullYear()}`;
}

export function connectionPhase(i: ConnectionStatusInput): ConnectionPhase {
  if (!i.status || i.status === "disabled") return i.providerConfigured ? "not_connected" : "inactive";
  if (i.status === "error" && !i.lastInvoiceAt) return "error";
  if (i.lastInvoiceAt) return "connected";
  return "waiting";
}

export function connectionLabel(i: ConnectionStatusInput, now = new Date()): string {
  switch (connectionPhase(i)) {
    case "inactive":
      return "Ricezione automatica non ancora attiva";
    case "not_connected":
      return "Non collegato";
    case "error":
      return "Da sistemare";
    case "waiting":
      return "In attesa della prima fattura";
    case "connected":
      return `Collegato ✓, ultima fattura ricevuta ${relativeDayIt(i.lastInvoiceAt!, now)}`;
  }
}
