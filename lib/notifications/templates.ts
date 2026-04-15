/**
 * Italian templates for notifications.
 * Returns {subject, html, text, title, body, link} per event type.
 */

import type { NotificationEventType } from "./dispatcher";

export interface TemplateInput {
  /** payload from dispatchEvent */
  payload: Record<string, unknown>;
  /** recipient display name if known */
  recipientName?: string;
  /** base URL (e.g. https://app.gastrobridge.it) */
  baseUrl?: string;
}

export interface RenderedTemplate {
  subject: string;
  html: string;
  text: string;
  title: string;
  body: string;
  link?: string;
}

const BRAND_COLOR = "#16a34a";

function layout(title: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  return `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f6f7f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f8;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td style="background:${BRAND_COLOR};padding:16px 24px;color:#fff;font-weight:600;font-size:16px;">GastroBridge</td></tr>
        <tr><td style="padding:24px;color:#111;line-height:1.5;font-size:14px;">
          <h1 style="margin:0 0 12px;font-size:18px;">${escapeHtml(title)}</h1>
          ${bodyHtml}
          ${cta ? `<p style="margin:24px 0 0;"><a href="${escapeAttr(cta.url)}" style="background:${BRAND_COLOR};color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;display:inline-block;font-weight:500;">${escapeHtml(cta.label)}</a></p>` : ""}
        </td></tr>
        <tr><td style="padding:16px 24px;background:#fafafa;color:#6b7280;font-size:12px;">Questa è una notifica automatica di GastroBridge. Puoi gestire le preferenze dalla pagina Impostazioni &rsaquo; Notifiche.</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}

function str(payload: Record<string, unknown>, key: string, fallback = ""): string {
  const v = payload[key];
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : fallback;
}

export function renderTemplate(
  eventType: NotificationEventType,
  input: TemplateInput
): RenderedTemplate {
  const { payload, baseUrl = "" } = input;
  const splitId = str(payload, "splitId");
  const supplierName = str(payload, "supplierName", "Fornitore");
  const restaurantName = str(payload, "restaurantName", "Ristorante");
  const orderNumber = str(payload, "orderNumber", splitId ? splitId.slice(0, 8) : "—");

  switch (eventType) {
    case "order_received": {
      const title = `Nuovo ordine da ${restaurantName}`;
      const body = `È arrivato un nuovo ordine #${orderNumber}. Aprilo per accettarlo o modificarlo.`;
      const link = splitId ? `${baseUrl}/supplier/ordini/${splitId}` : `${baseUrl}/supplier/ordini`;
      return {
        subject: `Nuovo ordine #${orderNumber} — ${restaurantName}`,
        title,
        body,
        link,
        text: `${body}\n\nApri: ${link}`,
        html: layout(title, `<p>${escapeHtml(body)}</p>`, { label: "Vedi ordine", url: link }),
      };
    }
    case "order_accepted": {
      const title = `Ordine #${orderNumber} accettato`;
      const body = `${supplierName} ha accettato il tuo ordine. Ti aggiorneremo appena sarà in spedizione.`;
      const link = splitId ? `${baseUrl}/ordini/${splitId}` : `${baseUrl}/ordini`;
      return {
        subject: `Ordine #${orderNumber} accettato da ${supplierName}`,
        title, body, link,
        text: `${body}\n\nDettagli: ${link}`,
        html: layout(title, `<p>${escapeHtml(body)}</p>`, { label: "Dettagli ordine", url: link }),
      };
    }
    case "order_shipped": {
      const title = `Ordine #${orderNumber} in consegna`;
      const body = `${supplierName} ha spedito il tuo ordine. Tieniti pronto per riceverlo.`;
      const link = splitId ? `${baseUrl}/ordini/${splitId}` : `${baseUrl}/ordini`;
      return {
        subject: `Ordine #${orderNumber} in consegna`,
        title, body, link,
        text: `${body}\n\nDettagli: ${link}`,
        html: layout(title, `<p>${escapeHtml(body)}</p>`, { label: "Dettagli ordine", url: link }),
      };
    }
    case "order_delivered": {
      const title = `Ordine #${orderNumber} consegnato`;
      const body = `L'ordine è stato consegnato. Puoi confermarne la ricezione nei dettagli.`;
      const link = splitId ? `${baseUrl}/ordini/${splitId}` : `${baseUrl}/ordini`;
      return {
        subject: `Ordine #${orderNumber} consegnato`,
        title, body, link,
        text: `${body}\n\nDettagli: ${link}`,
        html: layout(title, `<p>${escapeHtml(body)}</p>`, { label: "Dettagli ordine", url: link }),
      };
    }
    case "stock_low": {
      const productName = str(payload, "productName", "un prodotto");
      const quantity = str(payload, "quantity", "");
      const title = `Scorta bassa: ${productName}`;
      const body = quantity
        ? `La scorta di ${productName} è scesa sotto la soglia minima (${quantity}).`
        : `La scorta di ${productName} è scesa sotto la soglia minima.`;
      const link = `${baseUrl}/supplier/magazzino`;
      return {
        subject: `Scorta bassa: ${productName}`,
        title, body, link,
        text: `${body}\n\nGestisci scorte: ${link}`,
        html: layout(title, `<p>${escapeHtml(body)}</p>`, { label: "Vai al magazzino", url: link }),
      };
    }
    case "lot_expiring": {
      const productName = str(payload, "productName", "un lotto");
      const days = str(payload, "daysToExpiry", "");
      const title = `Lotto in scadenza: ${productName}`;
      const body = days
        ? `Il lotto di ${productName} scade tra ${days} giorni. Valuta promozioni o rotazione FIFO.`
        : `Il lotto di ${productName} è in scadenza. Valuta promozioni o rotazione FIFO.`;
      const link = `${baseUrl}/supplier/magazzino/lotti`;
      return {
        subject: `Lotto in scadenza: ${productName}`,
        title, body, link,
        text: `${body}\n\nGestisci lotti: ${link}`,
        html: layout(title, `<p>${escapeHtml(body)}</p>`, { label: "Vai ai lotti", url: link }),
      };
    }
    case "delivery_failed": {
      const reason = str(payload, "reason", "Motivo non specificato");
      const title = `Consegna fallita — ordine #${orderNumber}`;
      const body = `La consegna non è andata a buon fine. Motivo: ${reason}. Ripianifica o contatta il cliente.`;
      const link = splitId ? `${baseUrl}/supplier/ordini/${splitId}` : `${baseUrl}/supplier/consegne`;
      return {
        subject: `Consegna fallita — ordine #${orderNumber}`,
        title, body, link,
        text: `${body}\n\nApri: ${link}`,
        html: layout(title, `<p>${escapeHtml(body)}</p>`, { label: "Apri consegna", url: link }),
      };
    }
  }
}
