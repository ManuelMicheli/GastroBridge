/**
 * Calcola il livello "semaforo" per una data di scadenza lotto.
 *
 * Livelli:
 * - `expired`: scadenza nel passato (days < 0)
 * - `critical`: scadenza entro 7 giorni (ambra)
 * - `warning`: scadenza entro 30 giorni (giallo)
 * - `ok`: scadenza oltre 30 giorni
 * - `none`: nessuna data di scadenza impostata
 */
export type ExpirySeverity =
  | "expired"
  | "critical"
  | "warning"
  | "ok"
  | "none";

export type ExpiryInfo = {
  severity: ExpirySeverity;
  daysToExpiry: number | null;
};

/**
 * Ritorna il numero di giorni calendario tra `today` e `expiryDate`.
 * Usa la differenza di date a mezzanotte UTC per evitare DST drift.
 */
export function daysBetween(
  expiryDate: string | Date,
  today: Date = new Date(),
): number {
  const end = typeof expiryDate === "string" ? new Date(expiryDate) : expiryDate;
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const b = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const MS_DAY = 24 * 60 * 60 * 1000;
  return Math.round((b - a) / MS_DAY);
}

export function getExpiryInfo(
  expiryDate: string | null,
  today: Date = new Date(),
): ExpiryInfo {
  if (!expiryDate) return { severity: "none", daysToExpiry: null };
  const days = daysBetween(expiryDate, today);
  if (days < 0) return { severity: "expired", daysToExpiry: days };
  if (days <= 7) return { severity: "critical", daysToExpiry: days };
  if (days <= 30) return { severity: "warning", daysToExpiry: days };
  return { severity: "ok", daysToExpiry: days };
}

/** Label italiana sintetica per il badge (es. "Scaduto", "3 giorni", "—"). */
export function getExpiryLabel(info: ExpiryInfo): string {
  if (info.severity === "none" || info.daysToExpiry === null) return "—";
  if (info.severity === "expired") return "Scaduto";
  if (info.daysToExpiry === 0) return "Oggi";
  if (info.daysToExpiry === 1) return "1 giorno";
  return `${info.daysToExpiry} giorni`;
}
