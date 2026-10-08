// lib/fiscal/pos-help.ts
// Contextual help for connecting each POS (formerly the standalone
// /finanze/guida page). Plain data, shown next to the thing it explains.

export interface PosHelp {
  title: string;
  steps: string[];
  note?: string;
}

export const POS_HELP: Record<string, PosHelp> = {
  tilby: {
    title: "Tilby",
    steps: [
      "Accedi ad admin.tilby.com con l'account amministratore.",
      "Vai su Impostazioni → API & Integrazioni → OAuth Apps.",
      "Se GastroBridge è nell'elenco premi Autorizza, altrimenti scrivici con l'ID della cassa mostrato qui.",
      "Accetta i permessi in sola lettura (scontrini, articoli, categorie).",
      "Torna qui: la spia diventa verde entro un paio di minuti.",
    ],
  },
  cassa_in_cloud: {
    title: "Cassa in Cloud",
    steps: [
      "Accedi ad app.cassanova.com.",
      "Vai su Impostazioni → Integrazioni → API Key e genera una nuova chiave chiamata «GastroBridge».",
      "Dai solo permessi di lettura: Scontrini, Articoli, Categorie.",
      "Copia la chiave (si vede una volta sola) e incollala qui in «Inserisci la chiave API».",
    ],
  },
  lightspeed: {
    title: "Lightspeed Restaurant (K-Series)",
    steps: [
      "Dopo aver aggiunto la cassa qui, premi «Autorizza con Lightspeed».",
      "Accedi con l'account amministratore e scegli il locale giusto.",
      "Accetta i permessi di lettura: verrai riportato qui con la cassa già attiva.",
    ],
  },
  scloby: {
    title: "Scloby",
    steps: [
      "Accedi al pannello web di scloby.com (non l'app cassa).",
      "Vai su Impostazioni negozio → API → Chiavi API e crea una chiave «GastroBridge» in sola lettura.",
      "Copiala e incollala qui in «Inserisci la chiave API».",
    ],
  },
  generic_webhook: {
    title: "Altra cassa (webhook)",
    steps: [
      "Nel pannello della cassa cerca Webhook / Notifiche / Eventi esterni.",
      "Imposta l'URL /api/fiscal/webhooks/generic_webhook con metodo POST e corpo JSON a ogni scontrino chiuso.",
      "Aggiungi gli header x-gb-integration-id (l'ID mostrato qui) e x-gb-signature (HMAC-SHA256 del corpo con il segreto).",
    ],
    note: "Se il tuo installatore non sa calcolare la firma HMAC scrivici: forniamo uno script pronto.",
  },
  csv_upload: {
    title: "Import CSV",
    steps: [
      "Esporta gli scontrini dalla cassa in CSV (giornaliero o settimanale).",
      "Apri Collegamenti → Importa CSV e trascina il file: le colonne vengono riconosciute da sole.",
      "Controlla l'anteprima e premi Importa.",
    ],
    note: "Servono almeno: data, numero scontrino, totale, prodotto, quantità e prezzo unitario.",
  },
};

export function posHelpFor(provider: string): PosHelp | null {
  return POS_HELP[provider] ?? null;
}
