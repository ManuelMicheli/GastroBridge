import type { Metadata } from "next";
import Link from "next/link";
import { SUPPLIER_PLANS } from "@/lib/utils/constants";
import { EditorialEyebrow } from "@/components/marketing/_primitives/editorial-eyebrow";
import { SectionRule } from "@/components/marketing/_primitives/section-rule";
import { QuotePull } from "@/components/marketing/_primitives/quote-pull";

export const metadata: Metadata = {
  title: "Per i Fornitori",
  description:
    "Raggiungi centinaia di ristoratori nel Nord Italia. Gestisci catalogo, ordini e consegne da un'unica piattaforma.",
};

const BENEFITS = [
  {
    title: "Nuovi clienti, zero acquisizione",
    description:
      "Raggiungi ristoratori della tua zona di consegna senza investire in marketing.",
  },
  {
    title: "Crescita misurabile",
    description:
      "In media +25% ordini nei primi tre mesi. Dati reali, non promesse.",
  },
  {
    title: "Verifica e fiducia",
    description:
      "Il badge fornitore verificato distingue la tua azienda dalla concorrenza.",
  },
  {
    title: "Analytics di mercato",
    description:
      "Vendite, prodotti richiesti, trend. In tempo reale, leggibili in un colpo d'occhio.",
  },
  {
    title: "Gestione ordini centralizzata",
    description:
      "Ricevi notifiche, conferma e traccia consegne da un solo posto.",
  },
  {
    title: "Catalogo in pochi secondi",
    description:
      "Import CSV: carichi tutti i tuoi prodotti con un singolo file.",
  },
];

export default function ForSuppliersPage() {
  return (
    <div data-side="supplier">
      {/* Hero */}
      <section
        style={{
          paddingLeft: "var(--gutter-marketing)",
          paddingRight: "var(--gutter-marketing)",
          paddingTop: "clamp(160px, 18vw, 240px)",
          paddingBottom: "var(--rhythm-section)",
          background: "var(--color-marketing-bg)",
        }}
      >
        <div className="grid grid-cols-12 gap-y-10 gap-x-6 lg:gap-x-10">
          <div className="col-span-12 lg:col-span-4">
            <EditorialEyebrow number="N.02" tone="primary">PER FORNITORI</EditorialEyebrow>
          </div>
          <h1
            className="col-span-12 lg:col-span-10 font-display"
            style={{
              fontSize: "var(--type-marketing-display)",
              lineHeight: "var(--type-marketing-display-lh)",
              letterSpacing: "var(--type-marketing-display-ls)",
              color: "var(--color-marketing-ink)",
            }}
          >
            Nuovi clienti.
            <br />
            Zero intermediari.
          </h1>
          <p
            className="col-span-12 lg:col-span-6 lg:col-start-5"
            style={{
              fontSize: "var(--type-marketing-body)",
              lineHeight: "var(--type-marketing-body-lh)",
              color: "var(--color-marketing-ink-muted)",
              maxWidth: "58ch",
              marginTop: "clamp(16px, 2vw, 32px)",
            }}
          >
            Raggiungi ristoratori del Nord Italia, gestisci catalogo, ordini e
            consegne da un&apos;unica piattaforma professionale.
          </p>
          <div className="col-span-12 lg:col-start-5 mt-4">
            <Link
              href="/signup?role=supplier"
              className="inline-flex items-center rounded-full px-6 py-3 text-[14px] tracking-wide transition-colors"
              style={{
                background: "var(--color-marketing-primary)",
                color: "var(--color-marketing-on-primary)",
              }}
            >
              Diventa fornitore →
            </Link>
          </div>
        </div>
      </section>

      <SectionRule />

      {/* Benefits */}
      <section
        style={{
          paddingLeft: "var(--gutter-marketing)",
          paddingRight: "var(--gutter-marketing)",
          paddingTop: "var(--rhythm-section)",
          paddingBottom: "var(--rhythm-section)",
        }}
      >
        <div className="grid grid-cols-12 gap-y-10 gap-x-6 lg:gap-x-10 mb-[clamp(48px,6vw,96px)]">
          <div className="col-span-12 lg:col-span-4">
            <EditorialEyebrow number="— 02">VANTAGGI</EditorialEyebrow>
          </div>
          <h2
            className="col-span-12 lg:col-span-8 font-display"
            style={{
              fontSize: "var(--type-marketing-h2)",
              lineHeight: "var(--type-marketing-h2-lh)",
              letterSpacing: "var(--type-marketing-h2-ls)",
              color: "var(--color-marketing-ink)",
            }}
          >
            Perché stare su GastroBridge
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[1px]">
          {BENEFITS.map((b, i) => (
            <div
              key={b.title}
              className="p-8 lg:p-10 flex flex-col"
              style={{
                border: "1px solid var(--color-marketing-rule)",
                background: "var(--color-marketing-bg)",
                minHeight: "clamp(220px, 22vw, 280px)",
              }}
            >
              <p
                className="font-mono tracking-[0.15em] mb-6"
                style={{
                  fontSize: "11px",
                  color: "var(--color-marketing-primary)",
                }}
              >
                {String(i + 1).padStart(2, "0")} / 06
              </p>
              <h3
                className="font-display mb-4"
                style={{
                  fontSize: "clamp(22px, 2.2vw, 28px)",
                  lineHeight: "1.12",
                  letterSpacing: "-0.018em",
                  color: "var(--color-marketing-ink)",
                }}
              >
                {b.title}
              </h3>
              <p
                className="max-w-[36ch]"
                style={{
                  fontSize: "15px",
                  lineHeight: "1.55",
                  color: "var(--color-marketing-ink-muted)",
                }}
              >
                {b.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <SectionRule />

      {/* Quote */}
      <section
        style={{
          paddingLeft: "var(--gutter-marketing)",
          paddingRight: "var(--gutter-marketing)",
          paddingTop: "var(--rhythm-section)",
          paddingBottom: "var(--rhythm-section)",
          background: "var(--color-marketing-accent-warm-subtle)",
        }}
      >
        <div className="grid grid-cols-12 gap-x-6 lg:gap-x-10">
          <div className="col-span-12 lg:col-span-4">
            <EditorialEyebrow number="— 03">VOCE</EditorialEyebrow>
          </div>
          <div className="col-span-12 lg:col-span-8">
            <QuotePull
              quote="Dopo tre mesi su GastroBridge, abbiamo aperto a quaranta nuovi ristoranti senza spendere un euro in pubblicità."
              author="Laura B."
              role="Responsabile vendite — Caseificio Esempio, Lodi"
            />
          </div>
        </div>
      </section>

      <SectionRule />

      {/* Plans */}
      <section
        style={{
          paddingLeft: "var(--gutter-marketing)",
          paddingRight: "var(--gutter-marketing)",
          paddingTop: "var(--rhythm-section)",
          paddingBottom: "var(--rhythm-section)",
        }}
      >
        <div className="grid grid-cols-12 gap-y-10 gap-x-6 lg:gap-x-10 mb-[clamp(48px,6vw,96px)]">
          <div className="col-span-12 lg:col-span-4">
            <EditorialEyebrow number="— 04">PIANI</EditorialEyebrow>
          </div>
          <h2
            className="col-span-12 lg:col-span-8 font-display"
            style={{
              fontSize: "var(--type-marketing-h2)",
              lineHeight: "var(--type-marketing-h2-lh)",
              letterSpacing: "var(--type-marketing-h2-ls)",
              color: "var(--color-marketing-ink)",
            }}
          >
            Scegli un piano
            <br />
            e apri il catalogo.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-[1px]">
          {SUPPLIER_PLANS.map((plan) => {
            const highlighted = !!plan.highlighted;
            return (
              <div
                key={plan.id}
                className="relative flex flex-col"
                style={{
                  border: highlighted
                    ? "1px solid var(--color-marketing-primary)"
                    : "1px solid var(--color-marketing-rule)",
                  padding: "clamp(28px, 3vw, 48px)",
                  background: "var(--color-marketing-bg)",
                  minHeight: "clamp(440px, 48vw, 560px)",
                }}
              >
                {highlighted && (
                  <span
                    className="absolute -top-3 left-0 font-mono uppercase px-2"
                    style={{
                      fontSize: "11px",
                      letterSpacing: "0.22em",
                      background: "var(--color-marketing-bg)",
                      color: "var(--color-marketing-primary)",
                    }}
                  >
                    Consigliato
                  </span>
                )}
                <p
                  className="font-mono uppercase mb-8"
                  style={{
                    fontSize: "var(--type-marketing-eyebrow)",
                    letterSpacing: "var(--type-marketing-eyebrow-ls)",
                    color: "var(--color-marketing-ink-subtle)",
                  }}
                >
                  {plan.id.toUpperCase()}
                </p>
                <h3
                  className="font-display mb-8"
                  style={{
                    fontSize: "clamp(28px, 2.6vw, 40px)",
                    lineHeight: "1.05",
                    letterSpacing: "-0.02em",
                    color: "var(--color-marketing-ink)",
                  }}
                >
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-2 mb-10">
                  <span
                    className="font-display tabular-nums"
                    style={{
                      fontSize: "clamp(48px, 6vw, 72px)",
                      lineHeight: "0.92",
                      letterSpacing: "-0.03em",
                      color: "var(--color-marketing-ink)",
                    }}
                  >
                    €{plan.price}
                  </span>
                  <span
                    className="font-mono uppercase"
                    style={{
                      fontSize: "11px",
                      letterSpacing: "0.2em",
                      color: "var(--color-marketing-ink-subtle)",
                    }}
                  >
                    / {plan.period}
                  </span>
                </div>
                <ul className="space-y-3 mb-10 flex-1">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-baseline gap-3"
                      style={{
                        fontSize: "15px",
                        lineHeight: "1.5",
                        color: "var(--color-marketing-ink)",
                      }}
                    >
                      <span
                        aria-hidden
                        className="font-display"
                        style={{ color: "var(--color-marketing-primary)" }}
                      >
                        —
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/signup?role=supplier&plan=${plan.id}`}
                  className="inline-flex items-center justify-center w-full py-3 text-[14px] tracking-wide transition-colors rounded-full"
                  style={
                    highlighted
                      ? {
                          background: "var(--color-marketing-primary)",
                          color: "var(--color-marketing-on-primary)",
                        }
                      : {
                          border: "1px solid var(--color-marketing-rule-strong)",
                          color: "var(--color-marketing-ink)",
                        }
                  }
                >
                  Scegli {plan.name} →
                </Link>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
