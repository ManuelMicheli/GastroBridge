// lib/fiscal/format.ts
// Display helpers for the finanze UI.

export function formatCents(cents: number): string {
  const euro = cents / 100;
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(euro);
}

export function formatCentsCompact(cents: number): string {
  const euro = cents / 100;
  if (Math.abs(euro) >= 1000) {
    return `${(euro / 1000).toFixed(1)}k €`;
  }
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(euro);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
  });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPct(pct: number | null): string {
  if (pct === null || Number.isNaN(pct)) return "—";
  return `${pct.toFixed(1)}%`;
}

export function providerLabel(provider: string): string {
  const map: Record<string, string> = {
    tilby: "Tilby",
    cassa_in_cloud: "Cassa in Cloud",
    lightspeed: "Lightspeed",
    scloby: "Scloby",
    tcpos: "TCPOS",
    revo: "Revo",
    simphony: "Oracle Simphony",
    hiopos: "HIOPOS",
    generic_webhook: "Webhook generico",
    csv_upload: "Import CSV",
  };
  return map[provider] ?? provider;
}

export function paymentLabel(method: string | null): string {
  if (!method) return "—";
  const map: Record<string, string> = {
    cash: "Contanti",
    card: "Carta",
    meal_voucher: "Buono pasto",
    other: "Altro",
  };
  return map[method] ?? method;
}
