import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Guida collegamento POS",
};

export default async function GuidaPage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string }>;
}) {
  const qs = await searchParams;
  const backHref = qs.r ? `/finanze?r=${qs.r}` : "/finanze";

  return (
    <div className="p-4 lg:p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href={backHref}
          className="text-text-tertiary hover:text-text-secondary"
          aria-label="Torna al dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-tertiary font-bold">
            Cassetto Fiscale · Guida
          </p>
          <h1 className="text-2xl font-semibold text-text-primary">
            Collegare la tua cassa al Cassetto Fiscale
          </h1>
        </div>
      </div>

      <article className="space-y-8 text-sm leading-relaxed text-text-secondary">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-text-primary">
            Prima di iniziare
          </h2>
          <p>Serve:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong className="text-text-primary">Account GastroBridge</strong>{" "}
              con almeno una sede creata (Impostazioni → Sedi).
            </li>
            <li>
              <strong className="text-text-primary">Accesso admin alla tua cassa</strong>{" "}
              (chi ha creato l&apos;account POS o l&apos;installatore).
            </li>
            <li>
              <strong className="text-text-primary">5–10 minuti</strong>.
            </li>
          </ul>
        </section>

        <hr className="border-border-subtle" />

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">
            Parte 1 — Lato Piattaforma (GastroBridge)
          </h2>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-text-primary">
              Step 1 — Attiva il Cassetto Fiscale
            </h3>
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                Dal menu laterale: <strong>Gestione → Finanze</strong>
              </li>
              <li>
                In alto a destra clicca <strong>Integrazioni POS</strong>
              </li>
              <li>
                Nel box &quot;Stato Cassetto Fiscale&quot; premi{" "}
                <strong>Attiva</strong> (diventa verde)
              </li>
            </ol>
            <p className="text-xs text-text-tertiary">
              Senza questo step non puoi aggiungere integrazioni.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-text-primary">
              Step 2 — Apri la connessione
            </h3>
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                Nella sezione &quot;Integrazioni collegate&quot; premi{" "}
                <strong>+ Aggiungi</strong>
              </li>
              <li>
                Scegli il tuo POS dal menu:{" "}
                <strong>Tilby, Cassa in Cloud, Lightspeed, Scloby</strong>{" "}
                oppure <strong>Webhook generico</strong>
              </li>
              <li>
                Inserisci <strong>Nome</strong> (es. &quot;Cassa sala&quot;) e{" "}
                <strong>Device ID</strong> (opzionale)
              </li>
              <li>
                Premi <strong>Crea integrazione</strong>
              </li>
            </ol>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-text-primary">
              Step 3 — Salva il segreto (solo per webhook)
            </h3>
            <p>
              Se hai scelto <strong>Webhook generico</strong> vedrai una card
              verde con segreto, URL endpoint e header{" "}
              <code className="font-mono text-xs bg-surface-base px-1.5 py-0.5 rounded">
                x-gb-integration-id
              </code>
              .
            </p>
            <div className="bg-accent-orange/10 border border-accent-orange/30 rounded-xl px-4 py-3 text-xs text-accent-orange">
              <strong>IMPORTANTE:</strong> il segreto lo vedi una sola volta.
              Copialo subito in un posto sicuro. Se lo perdi devi rifare
              l&apos;integrazione da zero.
            </div>
          </div>
        </section>

        <hr className="border-border-subtle" />

        <section className="space-y-5">
          <h2 className="text-lg font-semibold text-text-primary">
            Parte 2 — Lato POS
          </h2>

          <ProviderBlock
            dot="bg-accent-green"
            title="Tilby"
            steps={[
              "Login su admin.tilby.com",
              "Menu: Impostazioni → API & Integrazioni → OAuth Apps",
              "Se GastroBridge è già nell'elenco → premi Autorizza",
              "Altrimenti → contatta supporto@gastrobridge.com con l'ID integrazione mostrato in piattaforma",
              "Accetta i permessi: lettura scontrini, lettura articoli, lettura categorie",
              "Torna su GastroBridge: la spia diventa verde entro 2 minuti",
            ]}
          />

          <ProviderBlock
            dot="bg-accent-green"
            title="Cassa in Cloud"
            steps={[
              "Login su app.cassanova.com",
              "Menu: Impostazioni → Integrazioni → API Key",
              "Genera nuova chiave → nome 'GastroBridge'",
              "Permessi: Scontrini (lettura), Articoli (lettura), Categorie (lettura)",
              "Copia la chiave (visibile una sola volta)",
              "GastroBridge → apri la card POS → Inserisci API key → Salva",
              "Prima sync entro 2 minuti",
            ]}
          />

          <ProviderBlock
            dot="bg-accent-green"
            title="Lightspeed Restaurant (K-Series)"
            steps={[
              "In GastroBridge, dopo aver creato l'integrazione, premi Autorizza con Lightspeed",
              "Login sul sito Lightspeed col tuo account admin",
              "Seleziona il business corretto (se ne hai più di uno)",
              "Accetta i permessi: read orders, read products, read customers",
              "Vieni rimandato automaticamente su GastroBridge: integrazione attiva",
            ]}
          />

          <ProviderBlock
            dot="bg-accent-green"
            title="Scloby"
            steps={[
              "Login su scloby.com (pannello admin web, non l'app cassa)",
              "Menu: Impostazioni negozio → API → Chiavi API",
              "Nuova chiave → nome 'GastroBridge' → permessi read-only scontrini + articoli",
              "Copia la chiave",
              "GastroBridge → incolla nella card del POS → Salva",
            ]}
          />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full bg-accent-orange"
                aria-hidden
              />
              <h3 className="text-sm font-semibold text-text-primary">
                Webhook generico (altre casse)
              </h3>
            </div>
            <p>
              Per casse che non hanno integrazione diretta ma supportano
              webhook.
            </p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Apri il pannello admin della tua cassa</li>
              <li>
                Trova <strong>Webhook / Notifiche / Eventi esterni</strong>
              </li>
              <li>Aggiungi webhook con i parametri sotto</li>
            </ol>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-border-subtle rounded-lg overflow-hidden">
                <tbody className="divide-y divide-border-subtle">
                  <Row k="URL">
                    <code className="font-mono">
                      https://gastrobridge.app/api/fiscal/webhooks/generic_webhook
                    </code>
                  </Row>
                  <Row k="Metodo">
                    <code className="font-mono">POST</code>
                  </Row>
                  <Row k="Evento">
                    <code className="font-mono">receipt.closed</code> (o
                    equivalente)
                  </Row>
                  <Row k="Content-Type">
                    <code className="font-mono">application/json</code>
                  </Row>
                  <Row k="Header 1">
                    <code className="font-mono">
                      x-gb-integration-id: &lt;id mostrato in piattaforma&gt;
                    </code>
                  </Row>
                  <Row k="Header 2">
                    <code className="font-mono">
                      x-gb-signature: &lt;HMAC-SHA256 del body col segreto&gt;
                    </code>
                  </Row>
                </tbody>
              </table>
            </div>
            <p className="text-xs">
              <strong className="text-text-primary">Firma HMAC:</strong> il body
              va firmato con <strong>HMAC-SHA256</strong> usando il segreto
              salvato nello Step 3.
            </p>
            <p className="text-xs font-medium text-text-primary">
              Payload minimo atteso:
            </p>
            <pre className="bg-surface-base border border-border-subtle rounded-lg p-3 text-xs font-mono text-text-primary overflow-x-auto">
              {`{
  "receipt_number": "0001/0042",
  "issued_at": "2026-04-21T14:32:10Z",
  "total_gross": 48.50,
  "total_net": 39.75,
  "total_vat": 8.75,
  "items": [
    { "name": "Pizza margherita", "qty": 2, "unit_price": 8.00, "category": "Pizza" }
  ]
}`}
            </pre>
            <p className="text-xs text-text-tertiary">
              Se il tuo installatore non sa gestire HMAC, contattaci: forniamo
              script Python/Node pronto.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full bg-accent-blue"
                aria-hidden
              />
              <h3 className="text-sm font-semibold text-text-primary">
                Import CSV (nessuna delle opzioni sopra)
              </h3>
            </div>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Esporta scontrini dalla cassa in CSV (giornaliero/settimanale)</li>
              <li>
                GastroBridge → <strong>Finanze → Integrazioni → Import CSV</strong>
              </li>
              <li>Trascina il file → il wizard riconosce da solo le colonne</li>
              <li>
                Controlla l&apos;anteprima → <strong>Importa</strong>
              </li>
            </ol>
            <p className="text-xs text-text-tertiary">
              Colonne minime: data scontrino, numero, totale, prodotto,
              quantità, prezzo unitario. Categoria e IVA opzionali.
            </p>
          </div>
        </section>

        <hr className="border-border-subtle" />

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-text-primary">
            Parte 3 — Verifica che funzioni
          </h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>
              Batti <strong>uno scontrino di test</strong> sulla cassa (anche
              1€)
            </li>
            <li>
              GastroBridge → <strong>Finanze → Scontrini</strong>
            </li>
            <li>
              Appare entro <strong>2 minuti</strong> per webhook + Tilby,{" "}
              <strong>2 ore</strong> per polling API (Cassa in Cloud, Scloby,
              Lightspeed)
            </li>
          </ol>
          <p>Se non arriva → controlla la spia nelle integrazioni:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <span className="inline-block h-2 w-2 rounded-full bg-accent-green mr-2 align-middle" />
              verde = attivo
            </li>
            <li>
              <span className="inline-block h-2 w-2 rounded-full bg-text-tertiary mr-2 align-middle" />
              grigio = in pausa
            </li>
            <li>
              <span className="inline-block h-2 w-2 rounded-full bg-accent-orange mr-2 align-middle" />
              rosso = errore (messaggio sotto al nome)
            </li>
          </ul>
        </section>

        <hr className="border-border-subtle" />

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-text-primary">
            Problemi comuni
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-border-subtle rounded-lg overflow-hidden">
              <thead className="bg-surface-base/40 text-text-tertiary uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Sintomo</th>
                  <th className="text-left px-3 py-2 font-medium">Causa</th>
                  <th className="text-left px-3 py-2 font-medium">Soluzione</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                <TroubleRow
                  s="Spia rossa 'invalid credentials'"
                  c="API key scaduta o revocata"
                  f="Rigenera sul POS, aggiorna su GastroBridge"
                />
                <TroubleRow
                  s="Spia rossa 'signature mismatch'"
                  c="Segreto webhook errato"
                  f="Verifica HMAC-SHA256, reinserisci segreto"
                />
                <TroubleRow
                  s="Nessuno scontrino dopo 2h"
                  c="Polling non ancora partito"
                  f="Bottone Sincronizza ora dalla card"
                />
                <TroubleRow
                  s="Scontrini doppi"
                  c="Webhook + polling attivi insieme"
                  f="Disattiva uno dei due"
                />
              </tbody>
            </table>
          </div>
        </section>

        <hr className="border-border-subtle" />

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-text-primary">Sicurezza</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Credenziali cifrate <strong>AES-256</strong>. Non vediamo chiavi
              in chiaro.
            </li>
            <li>
              Puoi mettere in <strong>pausa</strong> l&apos;integrazione senza
              perdere lo storico.
            </li>
            <li>
              Puoi <strong>eliminare</strong> l&apos;integrazione: scontrini
              storici restano, collegamento si ferma.
            </li>
            <li>
              Lato POS: revoca l&apos;API key o disabilita il webhook dal
              pannello admin.
            </li>
          </ul>
        </section>

        <hr className="border-border-subtle" />

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-text-primary">Supporto</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Email:{" "}
              <a
                href="mailto:supporto@gastrobridge.com"
                className="text-accent-green hover:underline"
              >
                supporto@gastrobridge.com
              </a>
            </li>
            <li>Orari: lun-ven 9:00-18:00</li>
          </ul>
        </section>

        <div className="pt-4">
          <Link
            href={qs.r ? `/finanze/integrazioni?r=${qs.r}` : "/finanze/integrazioni"}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-green px-4 py-2 text-sm font-medium text-surface-base hover:bg-accent-green/90"
          >
            Vai a Integrazioni POS
          </Link>
        </div>
      </article>
    </div>
  );
}

function ProviderBlock({
  dot,
  title,
  steps,
}: {
  dot: string;
  title: string;
  steps: string[];
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      </div>
      <ol className="list-decimal pl-5 space-y-1">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <tr>
      <td className="px-3 py-2 font-medium text-text-primary w-32 align-top">
        {k}
      </td>
      <td className="px-3 py-2 text-text-secondary">{children}</td>
    </tr>
  );
}

function TroubleRow({ s, c, f }: { s: string; c: string; f: string }) {
  return (
    <tr>
      <td className="px-3 py-2 text-text-primary">{s}</td>
      <td className="px-3 py-2 text-text-secondary">{c}</td>
      <td className="px-3 py-2 text-text-secondary">{f}</td>
    </tr>
  );
}
