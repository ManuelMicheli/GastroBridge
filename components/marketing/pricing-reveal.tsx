"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { gsap } from "@/lib/gsap-config";
import { EditorialEyebrow } from "./_primitives/editorial-eyebrow";
import { MOTION, prefersReducedMotion } from "@/lib/marketing-motion";

// v1 — two fixed plans. No volume slider, no modeled "savings vs intermediari"
// (that figure came from an assumed rate, not real data). Only true prices.
type Plan = {
  id: "base" | "pro";
  name: string;
  price: string;
  period: string;
  lead: string;
  features: readonly string[];
  recommended?: boolean;
};

const PLANS: readonly Plan[] = [
  {
    id: "base",
    name: "Base",
    price: "€50",
    period: "/mese",
    lead: "Tutto per ordinare e tenere i conti in ordine.",
    features: [
      "Catalogo vivo, prezzi aggiornati",
      "Ordini illimitati",
      "0% commissioni su ogni ordine",
      "Stripe + cassetto fiscale",
      "Storico ed export CSV/PDF",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "€150",
    period: "/mese",
    lead: "Per chi gestisce più sedi e vuole leggere i numeri.",
    recommended: true,
    features: [
      "Tutto di Base, più:",
      "Multi-sede",
      "Analytics avanzata",
      "API + webhook",
      "Supporto prioritario",
    ],
  },
] as const;

export function PricingReveal() {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      headerRef.current?.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => (el.style.opacity = "1"));
      cardsRef.current?.querySelectorAll<HTMLElement>("[data-card]").forEach((el) => (el.style.opacity = "1"));
      return;
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        headerRef.current?.querySelectorAll("[data-reveal]") ?? [],
        { opacity: 0, y: 18 },
        {
          opacity: 1,
          y: 0,
          duration: MOTION.duration.revealBase,
          stagger: MOTION.stagger.block,
          ease: MOTION.easeEditorial,
          scrollTrigger: { trigger: sectionRef.current, start: "top 78%", once: true },
        }
      );
      gsap.fromTo(
        cardsRef.current?.querySelectorAll("[data-card]") ?? [],
        { opacity: 0, y: 28 },
        {
          opacity: 1,
          y: 0,
          duration: MOTION.duration.revealLong,
          stagger: 0.1,
          ease: MOTION.easeEditorial,
          scrollTrigger: { trigger: cardsRef.current, start: "top 82%", once: true },
        }
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="prezzo"
      style={{
        paddingLeft: "var(--gutter-marketing)",
        paddingRight: "var(--gutter-marketing)",
        paddingTop: "var(--rhythm-section)",
        paddingBottom: "var(--rhythm-section)",
      }}
    >
      <div
        ref={headerRef}
        className="grid grid-cols-12 gap-y-12 gap-x-6 lg:gap-x-10 mb-[clamp(48px,6vw,96px)]"
      >
        <div data-reveal className="col-span-12 lg:col-span-4 opacity-0">
          <EditorialEyebrow number="— 04">PREZZO</EditorialEyebrow>
        </div>
        <h2
          data-reveal
          className="col-span-12 lg:col-span-8 font-display opacity-0"
          style={{
            fontSize: "var(--type-marketing-h2)",
            lineHeight: "var(--type-marketing-h2-lh)",
            letterSpacing: "var(--type-marketing-h2-ls)",
            color: "var(--color-marketing-ink)",
          }}
        >
          Un canone fisso.
          <br />
          <span style={{ color: "var(--color-marketing-primary)" }}>0% su ogni ordine.</span>
        </h2>
      </div>

      <div ref={cardsRef} className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            data-card
            className="opacity-0 flex flex-col"
            style={{
              border: plan.recommended
                ? "1px solid var(--color-marketing-primary)"
                : "0.5px solid var(--color-marketing-rule-strong)",
              borderRadius: 10,
              background: "var(--color-marketing-bg-soft)",
              padding: "clamp(28px, 3vw, 48px)",
            }}
          >
            <div className="flex items-center justify-between mb-8">
              <span
                className="font-mono uppercase"
                style={{
                  fontSize: "12px",
                  letterSpacing: "0.2em",
                  color: "var(--color-marketing-ink)",
                }}
              >
                {plan.name}
              </span>
              {plan.recommended && (
                <span
                  className="font-mono uppercase rounded-full px-3 py-1"
                  style={{
                    fontSize: "10px",
                    letterSpacing: "0.18em",
                    color: "var(--color-marketing-on-primary)",
                    background: "var(--color-marketing-primary)",
                  }}
                >
                  ★ Consigliato
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-2 mb-3">
              <span
                className="font-display leading-none"
                style={{
                  fontSize: "clamp(48px, 6vw, 88px)",
                  letterSpacing: "var(--type-marketing-display-ls)",
                  color: "var(--color-marketing-ink)",
                }}
              >
                {plan.price}
              </span>
              <span
                className="font-mono uppercase"
                style={{
                  fontSize: "13px",
                  letterSpacing: "0.14em",
                  color: "var(--color-marketing-ink-subtle)",
                }}
              >
                {plan.period}
              </span>
            </div>

            <p
              className="mb-8 max-w-[40ch]"
              style={{
                fontSize: "15px",
                lineHeight: 1.55,
                color: "var(--color-marketing-ink-muted)",
              }}
            >
              {plan.lead}
            </p>

            <ul
              className="space-y-3 mb-10"
              style={{ borderTop: "0.5px solid var(--color-marketing-rule)", paddingTop: "clamp(20px,2vw,28px)" }}
            >
              {plan.features.map((f, i) => {
                const isLead = plan.id === "pro" && i === 0;
                return (
                  <li
                    key={f}
                    className="flex items-baseline gap-3"
                    style={{
                      fontSize: "14px",
                      lineHeight: 1.5,
                      color: isLead ? "var(--color-marketing-ink-subtle)" : "var(--color-marketing-ink-muted)",
                    }}
                  >
                    {!isLead && (
                      <span aria-hidden style={{ color: "var(--color-marketing-primary)" }}>
                        —
                      </span>
                    )}
                    <span
                      className={isLead ? "font-mono uppercase" : ""}
                      style={
                        isLead
                          ? { fontSize: "11px", letterSpacing: "0.18em" }
                          : { color: "var(--color-marketing-ink)" }
                      }
                    >
                      {f}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-auto">
              <Link
                href="/signup?role=restaurant"
                className="group inline-flex items-center gap-3 rounded-full px-7 py-3.5 text-[14px] tracking-wide"
                style={
                  plan.recommended
                    ? {
                        background: "var(--color-marketing-primary)",
                        color: "var(--color-marketing-on-primary)",
                        transition: "background-color 240ms cubic-bezier(0.16, 1, 0.3, 1)",
                      }
                    : {
                        background: "transparent",
                        color: "var(--color-marketing-ink)",
                        border: "1px solid var(--color-marketing-rule-strong)",
                        transition: "border-color 240ms, color 240ms",
                      }
                }
                onMouseEnter={(e) => {
                  if (plan.recommended) e.currentTarget.style.background = "var(--color-marketing-primary-hover)";
                  else e.currentTarget.style.borderColor = "var(--color-marketing-primary)";
                }}
                onMouseLeave={(e) => {
                  if (plan.recommended) e.currentTarget.style.background = "var(--color-marketing-primary)";
                  else e.currentTarget.style.borderColor = "var(--color-marketing-rule-strong)";
                }}
              >
                Prova gratis
                <span aria-hidden className="inline-block transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </div>
          </div>
        ))}
      </div>

      <p
        className="mt-[clamp(32px,4vw,56px)] font-mono uppercase"
        style={{
          fontSize: "11px",
          letterSpacing: "0.2em",
          color: "var(--color-marketing-ink-subtle)",
        }}
      >
        14 giorni gratis · senza carta · disdici quando vuoi
      </p>
    </section>
  );
}
