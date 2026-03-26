"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils/formatters";

const FAQ_ITEMS = [
  {
    q: "Come funziona GastroBridge?",
    a: "GastroBridge e una piattaforma B2B che connette ristoratori e fornitori Ho.Re.Ca. Registrati, cerca prodotti, confronta prezzi da piu fornitori e ordina tutto da un unico posto.",
  },
  {
    q: "Quanto costa?",
    a: "Per i ristoratori, l'accesso base e gratuito. Offriamo anche piani premium con funzionalita avanzate come analytics, alert sui prezzi e supporto prioritario. I fornitori hanno piani dedicati per la gestione della vetrina prodotti.",
  },
  {
    q: "Come mi registro come fornitore?",
    a: "Clicca su 'Diventa Fornitore', compila il form con i dati della tua azienda e il catalogo prodotti. Il nostro team verifichera il profilo entro 24 ore.",
  },
  {
    q: "In quali zone e disponibile?",
    a: "Attualmente operiamo nel Nord Italia, con copertura in Lombardia, Piemonte, Veneto e Emilia-Romagna. Stiamo espandendo rapidamente verso altre regioni.",
  },
  {
    q: "I pagamenti sono sicuri?",
    a: "Assolutamente. Utilizziamo Stripe per processare tutti i pagamenti, garantendo la massima sicurezza con crittografia a livello bancario e protezione antifrode.",
  },
  {
    q: "Posso provare gratis?",
    a: "Si! I ristoratori possono registrarsi gratuitamente e iniziare subito a cercare e confrontare fornitori. Nessuna carta di credito richiesta.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 px-4 bg-cream">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-12 lg:gap-20">
        {/* Left — sticky title */}
        <div className="lg:w-1/3 lg:sticky lg:top-32 lg:self-start">
          <h2 className="text-3xl sm:text-4xl font-display text-forest mb-4">
            Domande Frequenti
          </h2>
          <p className="text-forest/60 font-body">
            Tutto quello che devi sapere per iniziare.
          </p>
        </div>

        {/* Right — accordion */}
        <div className="lg:w-2/3">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openIndex === i;
            const id = `faq-answer-${i}`;

            return (
              <div key={i} className="border-b border-forest/10">
                <button
                  id={`faq-q-${i}`}
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between py-5 text-left group"
                  aria-expanded={isOpen}
                  aria-controls={id}
                >
                  <span className="font-semibold text-forest font-body pr-4">
                    {item.q}
                  </span>
                  <Plus
                    className={cn(
                      "w-5 h-5 text-terracotta flex-shrink-0 transition-transform duration-300",
                      isOpen && "rotate-45"
                    )}
                  />
                </button>
                <div
                  id={id}
                  role="region"
                  aria-labelledby={`faq-q-${i}`}
                  className={cn(
                    "overflow-hidden transition-all duration-[400ms] ease-out",
                    isOpen ? "max-h-96 pb-5" : "max-h-0"
                  )}
                >
                  <p className="text-forest/80 font-body leading-relaxed">
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
