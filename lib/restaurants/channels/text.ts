// Order text for suppliers that are not on the platform (WhatsApp / email).
// Pure module: no I/O, safe on client and server.

export type OrderChannel = "whatsapp" | "email" | "pdf" | "phone";

export const CHANNEL_LABELS: Record<OrderChannel, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  pdf: "PDF / stampa",
  phone: "Telefono",
};

export type ChannelOrderLine = { qty: number; name: string; unit: string | null };

export type ChannelOrderText = {
  restaurantName: string;
  restaurantAddress?: string | null;
  restaurantPhone?: string | null;
  supplierLabel: string;
  contactName?: string | null;
  orderShortId: string;
  deliveryDate?: string | null;
  lines: ChannelOrderLine[];
  notes?: string | null;
};

function fmtQty(q: number): string {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 3 }).format(q);
}

/**
 * Plain, well-formatted Italian order (WhatsApp renders *bold*). No prices:
 * the supplier applies its own list, and prices in a chat cause disputes.
 */
export function buildOrderText(o: ChannelOrderText): string {
  const hello = o.contactName?.trim() ? `Buongiorno ${o.contactName.trim()},` : "Buongiorno,";
  const lines = o.lines.map((l) => `• ${fmtQty(l.qty)}${l.unit ? ` ${l.unit}` : ""} — ${l.name}`);
  const out = [
    hello,
    `ecco l'ordine di *${o.restaurantName}* (rif. ${o.orderShortId}):`,
    "",
    ...lines,
    "",
  ];
  if (o.deliveryDate) out.push(`Consegna richiesta: ${o.deliveryDate}`);
  if (o.notes?.trim()) out.push(`Note: ${o.notes.trim()}`);
  if (o.restaurantAddress?.trim()) out.push(`Indirizzo: ${o.restaurantAddress.trim()}`);
  if (o.restaurantPhone?.trim()) out.push(`Tel.: ${o.restaurantPhone.trim()}`);
  out.push("Grazie, attendiamo conferma.");
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

/**
 * Digits-only international number for wa.me. Italian numbers without a
 * prefix get 39 (mobile "3…", landline "0…").
 */
export function normalizeWhatsAppPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (/^(3\d{8,9}|0\d{5,10})$/.test(d)) d = `39${d}`;
  d = d.replace(/\D/g, "");
  return /^\d{6,15}$/.test(d) ? d : null;
}

export function whatsappLink(phone: string | null, text: string): string {
  const base = phone ? `https://wa.me/${phone}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

/** Parse the catalog-order notes qty ("2", "1,5") and "Name (unit)" line. */
export function splitNameUnit(raw: string): { name: string; unit: string | null } {
  const m = raw.match(/^(.*?)\s*\(([^()]{1,24})\)\s*$/);
  return m ? { name: m[1]!.trim() || raw, unit: m[2]!.trim() } : { name: raw.trim(), unit: null };
}
