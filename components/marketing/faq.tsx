"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/formatters";
import { EditorialEyebrow } from "./_primitives/editorial-eyebrow";

const FAQ_ITEMS = [
  {
    q: "Come funziona GastroBridge?",
    a: "È una piattaforma B2B che collega ristoratori e fornitori Ho.Re.Ca. italiani. Registri la tua attività, cerchi prodotti, confronti prezzi da più fornitori verificati e ordini da un unico posto. Nessun intermediario: la relazione commerciale resta tra te e il fornitore.",
  },
  {
    q: "Quanto costa per un ristorante?",
    a: "Per i ristoratori l'accesso base è gratuito e lo resta. I piani Premium (€29/mese) e Business (€79/mese) sbloccano analytics avanzati, alert sui prezzi, ordini multi-sede e supporto prioritario. Cambi o annulli quando vuoi, senza penali.",
  },
  {
    q: "Come guadagna GastroBridge se per il ristoratore è gratis?",
    a: "Sui piani a pagamento (ristoratori e fornitori) e sulle funzionalità premium. Non prendiamo commissioni sulle transazioni e non rivendiamo i dati. Vogliamo essere uno strumento che pagate se vi serve, non un intermediario che guadagna a vostra insaputa.",
  },
  {
    q: "Come mi registro come fornitore?",
    a: "Apri il profilo su /per-fornitori, compila i dati aziendali (P.IVA, sede, categorie di prodotto, zone di consegna) e carichi il catalogo (anche via CSV). Il team verifica il profilo entro ventiquattro ore lavorative e ti mette online.",
  },
  {
    q: "In quali zone è disponibile?",
    a: "Operiamo nel Nord Italia con copertura attiva in Lombardia, Piemonte, Veneto ed Emilia-Romagna. L'espansione verso Liguria, Trentino e Toscana è in corso per il 2026. Se il tuo territorio non è coperto, possiamo notificarti all'attivazione.",
  },
  {
    q: "I pagamenti sono sicuri?",
    a: "Processiamo i pagamenti tramite Stripe, con crittografia bancaria e protezione antifrode. Nessun dato di carta transita o viene memorizzato sui nostri server. Sono supportati bonifico SEPA, carta e pagamento concordato a 30 giorni.",
  },
  {
    q: "Posso provare senza impegno?",
    a: "Sì. I ristoratori si registrano gratis e iniziano subito a confrontare fornitori. Nessuna carta richiesta all'iscrizione. I fornitori hanno quattordici giorni di prova su qualunque piano a pagamento.",
  },
  {
    q: "Come vengono verificati i fornitori?",
    a: "Controlliamo P.IVA attiva, visura camerale, certificazioni dichiarate (HACCP, DOP, biologico) e un colloquio con il nostro team di onboarding. Se un fornitore non rispetta più gli standard — prezzi fantasma, consegne mancate ripetute — viene sospeso.",
  },
  {
    q: "Posso continuare a ordinare fuori dalla piattaforma?",
    a: "Certo. GastroBridge non ha esclusiva. Resti libero di lavorare con fornitori offline, di usarci per alcune categorie e non per altre. Non ti vincoliamo, e non ci offendiamo.",
  },
  {
    q: "Avete un'app mobile?",
    a: "La piattaforma è una PWA: si installa da browser su iOS e Android come un'app, senza passare dagli store. Riceve notifiche push per conferme ordine e consegne. App native iOS/Android sono previste per il 2026.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section
      id="faq"
      style={{
        paddingLeft: "var(--gutter-marketing)",
        paddingRight: "var(--gutter-marketing)",
        paddingTop: "var(--rhythm-section)",
        paddingBottom: "var(--rhythm-section)",
      }}
    >
      <div className="grid grid-cols-12 gap-y-12 gap-x-6 lg:gap-x-10">
        {/* Sticky title */}
        <div className="col-span-12 lg:col-span-4 lg:sticky lg:top-32 lg:self-start">
          <EditorialEyebrow number="— 08" className="mb-6">DOMANDE</EditorialEyebrow>
          <h2
            className="font-display"
            style={{
              fontSize: "var(--type-marketing-h2)",
              lineHeight: "var(--type-marketing-h2-lh)",
              letterSpacing: "var(--type-marketing-h2-ls)",
              color: "var(--color-marketing-ink)",
            }}
          >
            Risposte.
          </h2>
        </div>

        {/* Accordion */}
        <div
          className="col-span-12 lg:col-span-8"
          style={{ borderTop: "1px solid var(--color-marketing-rule)" }}
        >
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openIndex === i;
            const id = `faq-answer-${i}`;
            return (
              <div
                key={i}
                style={{ borderBottom: "1px solid var(--color-marketing-rule)" }}
              >
                <button
                  id={`faq-q-${i}`}
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between py-6 lg:py-7 text-left group"
                  aria-expanded={isOpen}
                  aria-controls={id}
                >
                  <span
                    className="pr-8 font-body font-medium"
                    style={{
                      fontSize: "18px",
                      lineHeight: "1.35",
                      color: "var(--color-marketing-ink)",
                    }}
                  >
                    {item.q}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "font-display leading-none transition-transform shrink-0",
                      isOpen ? "rotate-45" : "rotate-0"
                    )}
                    style={{
                      fontSize: "24px",
                      width: "24px",
                      height: "24px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--color-marketing-primary)",
                      transitionDuration: "360ms",
                      transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                  >
                    +
                  </span>
                </button>
                <div
                  id={id}
                  role="region"
                  aria-labelledby={`faq-q-${i}`}
                  className={cn(
                    "overflow-hidden transition-all",
                    isOpen ? "max-h-96 pb-7" : "max-h-0"
                  )}
                  style={{
                    transitionDuration: "360ms",
                    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                >
                  <p
                    className="max-w-[64ch]"
                    style={{
                      fontSize: "16px",
                      lineHeight: "1.6",
                      color: "var(--color-marketing-ink-muted)",
                    }}
                  >
                    {item.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
