// lib/finance/connections.ts
// "Stato collegamenti" of Finanze: health of the POS (casse) and of the SDI
// e-invoice reception, with the one action that fixes each problem. Pure.

import { connectionPhase, relativeDayIt } from "../invoices/onboarding.ts";

export type Health = "ok" | "waiting" | "warning" | "error" | "off";

export interface FixAction {
  label: string;
  /** Navigation target; omitted for server actions handled by the UI. */
  href?: string;
  /** Server action id handled by the client panel. */
  action?: "resume_pos" | "sync_sdi";
  targetId?: string;
}

export interface ConnectionCard {
  key: string;
  kind: "pos" | "sdi";
  title: string;
  subtitle: string;
  health: Health;
  status: string;
  lastSync: string | null;
  detail: string | null;
  fix: FixAction | null;
}

const POS_LABELS: Record<string, string> = {
  tilby: "Tilby",
  cassa_in_cloud: "Cassa in Cloud",
  lightspeed: "Lightspeed",
  scloby: "Scloby",
  tcpos: "TCPOS",
  revo: "Revo",
  simphony: "Simphony",
  hiopos: "HioPOS",
  generic_webhook: "Altra cassa (webhook)",
  csv_upload: "Import CSV",
};

const API_KEY_PROVIDERS = new Set(["cassa_in_cloud", "scloby"]);
const OAUTH_PROVIDERS = new Set(["tilby", "lightspeed"]);

export interface PosIntegrationInput {
  id: string;
  provider: string;
  status: "pending_auth" | "active" | "paused" | "error" | "revoked";
  display_name: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  hasApiKey?: boolean;
}

const HOUR = 3_600_000;

export function posCard(i: PosIntegrationInput, now = new Date()): ConnectionCard {
  const title = i.display_name?.trim() || POS_LABELS[i.provider] || i.provider;
  const base = {
    key: `pos:${i.id}`,
    kind: "pos" as const,
    title,
    subtitle: i.display_name ? POS_LABELS[i.provider] ?? i.provider : "Cassa",
    lastSync: i.last_synced_at,
  };
  const manage = { label: "Apri impostazioni cassa", href: "/finanze/integrazioni" };
  if (i.status === "paused") {
    return { ...base, health: "off", status: "In pausa", detail: "Gli scontrini non vengono importati.", fix: { label: "Riattiva", action: "resume_pos", targetId: i.id } };
  }
  if (i.status === "revoked") {
    return { ...base, health: "error", status: "Accesso revocato", detail: "La cassa ha revocato l'autorizzazione a GastroBridge.", fix: { ...manage, label: "Ricollega la cassa" } };
  }
  if (i.status === "pending_auth") {
    if (API_KEY_PROVIDERS.has(i.provider)) {
      return { ...base, health: "waiting", status: "Manca la chiave API", detail: "Genera la chiave nel pannello della cassa e incollala qui.", fix: { ...manage, label: "Inserisci la chiave API" } };
    }
    if (OAUTH_PROVIDERS.has(i.provider)) {
      return { ...base, health: "waiting", status: "Autorizzazione da completare", detail: "Accedi alla cassa e autorizza GastroBridge.", fix: { ...manage, label: "Completa l'autorizzazione" } };
    }
    if (i.provider === "csv_upload") {
      return { ...base, health: "waiting", status: "Nessun file importato", detail: null, fix: { label: "Importa un CSV", href: "/finanze/integrazioni/csv" } };
    }
    return { ...base, health: "waiting", status: "In attesa del primo scontrino", detail: "Configura il webhook nel pannello della cassa.", fix: manage };
  }
  if (i.status === "error") {
    return {
      ...base,
      health: "error",
      status: "Errore di sincronizzazione",
      detail: i.last_error ? i.last_error.slice(0, 200) : null,
      fix: API_KEY_PROVIDERS.has(i.provider) ? { ...manage, label: "Aggiorna la chiave API" } : { ...manage, label: "Ricollega la cassa" },
    };
  }
  // active
  if (i.provider === "csv_upload") {
    return {
      ...base,
      health: "ok",
      status: i.last_synced_at ? `Ultimo import ${relativeDayIt(i.last_synced_at, now)}` : "Attivo",
      detail: null,
      fix: { label: "Importa un nuovo CSV", href: "/finanze/integrazioni/csv" },
    };
  }
  if (!i.last_synced_at) {
    return { ...base, health: "waiting", status: "In attesa del primo scontrino", detail: null, fix: null };
  }
  const age = now.getTime() - Date.parse(i.last_synced_at);
  if (age > 48 * HOUR) {
    return {
      ...base,
      health: "warning",
      status: `Nessun dato da ${relativeDayIt(i.last_synced_at, now).replace(/^il /, "")}`,
      detail: "Se il locale era aperto, controlla che la cassa sia online.",
      fix: manage,
    };
  }
  return { ...base, health: "ok", status: `Collegata ✓, ultimo dato ${relativeDayIt(i.last_synced_at, now)}`, detail: null, fix: null };
}

/** Placeholder card when no POS is connected (or the module is off). */
export function posPlaceholderCard(fiscalEnabled: boolean, hasIntegrations: boolean): ConnectionCard | null {
  if (hasIntegrations && fiscalEnabled) return null;
  if (hasIntegrations && !fiscalEnabled) {
    return {
      key: "pos:disabled",
      kind: "pos",
      title: "Casse (POS)",
      subtitle: "Scontrini",
      health: "off",
      status: "Ricezione scontrini disattivata",
      lastSync: null,
      detail: "Le casse sono configurate ma la ricezione è spenta.",
      fix: { label: "Riattiva", href: "/finanze/integrazioni" },
    };
  }
  return {
    key: "pos:none",
    kind: "pos",
    title: "Casse (POS)",
    subtitle: "Scontrini",
    health: "off",
    status: "Nessuna cassa collegata",
    lastSync: null,
    detail: "Con la cassa collegata vedi incasso, food cost reale e quali piatti rendono di più.",
    fix: { label: "Collega la cassa", href: "/finanze/integrazioni" },
  };
}

export interface SdiInput {
  providerConfigured: boolean;
  connection: {
    status: "pending" | "active" | "error" | "disabled";
    recipient_code: string | null;
    portal_confirmed_at: string | null;
    last_invoice_at: string | null;
    last_sync_at: string | null;
    last_error: string | null;
  } | null;
  /** Last invoice imported by hand (upload), to show activity without SDI. */
  lastUploadAt: string | null;
}

export function sdiCard(i: SdiInput, now = new Date()): ConnectionCard {
  const base = { key: "sdi", kind: "sdi" as const, title: "Fatture elettroniche (SDI)", subtitle: "Fatture dei fornitori" };
  const c = i.connection;
  const phase = connectionPhase({
    providerConfigured: i.providerConfigured,
    status: c?.status ?? null,
    lastInvoiceAt: c?.last_invoice_at ?? null,
    lastError: c?.last_error ?? null,
  });
  const upload = i.lastUploadAt ? `Ultimo caricamento manuale ${relativeDayIt(i.lastUploadAt, now)}.` : null;
  switch (phase) {
    case "inactive":
      return {
        ...base,
        health: "off",
        status: "Ricezione automatica non ancora attiva",
        lastSync: null,
        detail: `Puoi già caricare i file XML, P7M o lo ZIP scaricato dal cassetto fiscale.${upload ? ` ${upload}` : ""}`,
        fix: { label: "Carica fatture", href: "/finanze/fatture#carica" },
      };
    case "not_connected":
      return {
        ...base,
        health: "off",
        status: "Non collegato",
        lastSync: null,
        detail: `Ricevi le fatture dei fornitori in automatico, senza scaricarle.${upload ? ` ${upload}` : ""}`,
        fix: { label: "Collega in 2 minuti", href: "/finanze/fatture/collega" },
      };
    case "error":
      return {
        ...base,
        health: "error",
        status: "Da sistemare",
        lastSync: c?.last_sync_at ?? null,
        detail: c?.last_error?.slice(0, 200) ?? null,
        fix: { label: "Riprova il collegamento", href: "/finanze/fatture/collega" },
      };
    case "waiting":
      return {
        ...base,
        health: "waiting",
        status: "In attesa della prima fattura",
        lastSync: c?.last_sync_at ?? null,
        detail: c?.portal_confirmed_at
          ? "Arriverà con la prossima fattura di un fornitore."
          : `Registra il codice ${c?.recipient_code ?? ""} sul portale Fatture e Corrispettivi.`.replace("  ", " "),
        fix: c?.portal_confirmed_at ? { label: "Controlla ora", action: "sync_sdi" } : { label: "Apri la guida", href: "/finanze/fatture/collega" },
      };
    case "connected": {
      const last = c!.last_invoice_at!;
      const stale = now.getTime() - Date.parse(last) > 30 * 24 * HOUR;
      if (stale) {
        return {
          ...base,
          health: "warning",
          status: `Nessuna fattura da ${relativeDayIt(last, now).replace(/^il /, "")}`,
          lastSync: c?.last_sync_at ?? null,
          detail: "Controlla sul portale che il codice destinatario sia ancora registrato.",
          fix: { label: "Controlla ora", action: "sync_sdi" },
        };
      }
      return {
        ...base,
        health: c?.last_error ? "warning" : "ok",
        status: `Collegato ✓, ultima fattura ricevuta ${relativeDayIt(last, now)}`,
        lastSync: c?.last_sync_at ?? null,
        detail: c?.last_error ? `Ultimo controllo: ${c.last_error.slice(0, 160)}` : null,
        fix: c?.last_error ? { label: "Controlla ora", action: "sync_sdi" } : null,
      };
    }
  }
}

export function overallHealth(cards: ConnectionCard[]): Health {
  if (cards.some((c) => c.health === "error")) return "error";
  if (cards.some((c) => c.health === "warning")) return "warning";
  if (cards.some((c) => c.health === "waiting")) return "waiting";
  if (cards.some((c) => c.health === "ok")) return "ok";
  return "off";
}
