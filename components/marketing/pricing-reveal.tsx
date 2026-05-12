"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { gsap } from "@/lib/gsap-config";
import { EditorialEyebrow } from "./_primitives/editorial-eyebrow";
import { MOTION, prefersReducedMotion } from "@/lib/marketing-motion";
import { usePersona, type Persona } from "@/lib/marketing-persona-context";

const STOPS = [500, 2500, 5000, 10000, 15000, 22500, 30000, 50000] as const;
const STOP_LABELS = ["€500", "€5k", "€15k", "€30k", "€50k+"] as const;
const PRO_THRESHOLD = 15000;
const SAVINGS_RATE = 0.028;

type Copy = {
  eyebrowLabel: string;
  heading: { primary: string; muted: string };
  question: string;
  volumeLabel: string;
  costLabel: string;
  commissionLabel: string;
  savingsLabel: string;
  savingsCompare: string;
  ctaPrimary: string;
};

const COPY: Record<Persona, Copy> = {
  restaurant: {
    eyebrowLabel: "PREZZO",
    heading: { primary: "Paghi solo", muted: "quello che usi." },
    question: "Quanto ordini al mese?",
    volumeLabel: "Volume ordini/mese",
    costLabel: "Costo GBR",
    commissionLabel: "Commissioni",
    savingsLabel: "Risparmio stimato",
    savingsCompare: "vs intermediari",
    ctaPrimary: "Inizia gratis",
  },
  supplier: {
    eyebrowLabel: "PREZZO",
    heading: { primary: "Vendi senza fee.", muted: "Punto." },
    question: "Quanto fatturi al mese sulla piattaforma?",
    volumeLabel: "Volume gestito/mese",
    costLabel: "Costo GBR",
    commissionLabel: "Commissioni sulle vendite",
    savingsLabel: "Risparmio stimato",
    savingsCompare: "vs canali di acquisizione",
    ctaPrimary: "Apri profilo fornitore",
  },
};

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function volumeFromPosition(pos: number): number {
  const min = STOPS[0] ?? 500;
  const max = STOPS[STOPS.length - 1] ?? 50000;
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  return Math.round(Math.exp(logMin + (logMax - logMin) * pos));
}

function formatEUR(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function PricingReveal() {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const volRef = useRef<HTMLSpanElement>(null);
  const costRef = useRef<HTMLSpanElement>(null);
  const savingsRef = useRef<HTMLSpanElement>(null);
  const animValuesRef = useRef({ vol: 0, cost: 0, savings: 0 });
  const [position, setPosition] = useState(0.5);
  const { persona } = usePersona();
  const copy = COPY[persona];

  const volume = volumeFromPosition(position);
  const isPro = volume >= PRO_THRESHOLD;
  const cost = isPro ? 49 : 0;
  const savings = Math.round(volume * SAVINGS_RATE);
  const roiInfinity = cost === 0 && savings > 0;

  useEffect(() => {
    if (prefersReducedMotion()) {
      headerRef.current?.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => (el.style.opacity = "1"));
      if (cardRef.current) cardRef.current.style.opacity = "1";
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
        cardRef.current,
        { opacity: 0, y: 28 },
        {
          opacity: 1,
          y: 0,
          duration: MOTION.duration.revealLong,
          ease: MOTION.easeEditorial,
          scrollTrigger: { trigger: cardRef.current, start: "top 80%", once: true },
        }
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (prefersReducedMotion()) {
      if (volRef.current) volRef.current.textContent = formatEUR(volume);
      if (costRef.current) costRef.current.textContent = formatEUR(cost);
      if (savingsRef.current) savingsRef.current.textContent = formatEUR(savings);
      animValuesRef.current = { vol: volume, cost, savings };
      return;
    }
    const targets = animValuesRef.current;
    gsap.to(targets, {
      vol: volume,
      cost,
      savings,
      duration: 0.45,
      ease: "power2.out",
      onUpdate() {
        if (volRef.current) volRef.current.textContent = formatEUR(Math.round(targets.vol));
        if (costRef.current) costRef.current.textContent = formatEUR(Math.round(targets.cost));
        if (savingsRef.current) savingsRef.current.textContent = formatEUR(Math.round(targets.savings));
      },
    });
  }, [volume, cost, savings]);

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
          <EditorialEyebrow number="— 04">{copy.eyebrowLabel}</EditorialEyebrow>
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
          {copy.heading.primary}
          <br />
          <span style={{ color: "var(--color-marketing-ink-muted)" }}>{copy.heading.muted}</span>
        </h2>
      </div>

      <div className="grid grid-cols-12 gap-y-12 gap-x-6 lg:gap-x-10">
        <div className="col-span-12 lg:col-span-5">
          <p
            className="font-mono uppercase mb-6"
            style={{
              fontSize: "11px",
              letterSpacing: "0.22em",
              color: "var(--color-marketing-ink-subtle)",
            }}
          >
            {copy.question}
          </p>

          <div className="font-display leading-none mb-8" style={{
            fontSize: "clamp(56px, 8vw, 128px)",
            letterSpacing: "var(--type-marketing-display-ls)",
            color: "var(--color-marketing-primary)",
          }}>
            <span ref={volRef}>{formatEUR(volume)}</span>
          </div>

          <input
            type="range"
            min={0}
            max={1000}
            step={1}
            value={Math.round(position * 1000)}
            onChange={(e) => setPosition(clamp(Number(e.target.value) / 1000, 0, 1))}
            aria-label={copy.question}
            className="gbr-pricing-slider w-full"
          />

          <div className="flex justify-between mt-3 font-mono uppercase" style={{
            fontSize: "10px",
            letterSpacing: "0.18em",
            color: "var(--color-marketing-ink-subtle)",
          }}>
            {STOP_LABELS.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        </div>

        <div
          ref={cardRef}
          className="col-span-12 lg:col-span-7 opacity-0 font-mono"
          style={{
            border: "0.5px solid var(--color-marketing-rule-strong)",
            borderRadius: 8,
            background: "var(--color-marketing-bg-soft)",
            padding: "clamp(28px, 3vw, 44px)",
          }}
        >
          <div className="flex items-center gap-3 mb-8">
            <span
              aria-hidden
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: "#1B6B4A", boxShadow: "0 0 0 3px rgba(27,107,74,0.12)" }}
            />
            <span className="uppercase" style={{ fontSize: "10px", letterSpacing: "0.22em", color: "var(--color-marketing-ink-muted)" }}>
              LIVE · GBR.QUOTE
            </span>
            <span aria-hidden className="opacity-30 ml-auto">|</span>
            <span className="uppercase" style={{ fontSize: "10px", letterSpacing: "0.18em", color: isPro ? "var(--color-marketing-primary)" : "var(--color-marketing-ink-subtle)" }}>
              PIANO: {isPro ? "PRO" : "STARTER"}
            </span>
          </div>

          <Row
            label={copy.costLabel}
            value={<span ref={costRef}>{formatEUR(cost)}</span>}
            suffix={cost > 0 ? "/mese" : "— sempre gratis sotto €15k"}
          />
          <Row label={copy.commissionLabel} value="0%" suffix="— da sempre" emphasized={false} />
          <Divider />
          <Row
            label={copy.savingsLabel}
            value={<span ref={savingsRef}>{formatEUR(savings)}</span>}
            suffix={`/mese · ${copy.savingsCompare}`}
            tone="positive"
          />
          <Row
            label="ROI"
            value={roiInfinity ? "∞" : `${((savings / Math.max(cost, 1)) || 0).toFixed(1)}x`}
            suffix={roiInfinity ? "— senza costo fisso" : "— costo recuperato"}
            tone="positive"
          />

          {isPro && (
            <>
              <Divider />
              <p
                className="uppercase mb-3"
                style={{
                  fontSize: "10px",
                  letterSpacing: "0.22em",
                  color: "var(--color-marketing-primary)",
                }}
              >
                ▲ Passa a Pro
              </p>
              <p
                style={{
                  fontSize: "13px",
                  lineHeight: 1.55,
                  color: "var(--color-marketing-ink-muted)",
                  fontFamily: "var(--font-body)",
                  maxWidth: "52ch",
                }}
              >
                Analytics avanzata, multi-sede, API, supporto prioritario.{" "}
                <span style={{ color: "var(--color-marketing-ink)" }}>€49/mese</span>, niente percentuali.
              </p>
            </>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              href="/signup"
              className="inline-flex items-center rounded-full px-6 py-3 text-[14px] tracking-wide"
              style={{
                background: "var(--color-marketing-primary)",
                color: "var(--color-marketing-on-primary)",
                fontFamily: "var(--font-body)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-marketing-primary-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-marketing-primary)")}
            >
              {copy.ctaPrimary}
            </Link>
            <Link
              href="/pricing"
              className="link-editorial text-[14px] tracking-wide text-[var(--color-marketing-ink)]"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Vedi tutti i piani →
            </Link>
          </div>
        </div>
      </div>

      <style jsx>{`
        .gbr-pricing-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 28px;
          background: transparent;
          cursor: ew-resize;
        }
        .gbr-pricing-slider::-webkit-slider-runnable-track {
          height: 1px;
          background: var(--color-marketing-rule-strong);
        }
        .gbr-pricing-slider::-moz-range-track {
          height: 1px;
          background: var(--color-marketing-rule-strong);
        }
        .gbr-pricing-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--color-marketing-primary);
          margin-top: -8.5px;
          box-shadow: 0 0 0 6px color-mix(in srgb, var(--color-marketing-primary) 18%, transparent);
          transition: box-shadow 200ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .gbr-pricing-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--color-marketing-primary);
          border: 0;
          box-shadow: 0 0 0 6px color-mix(in srgb, var(--color-marketing-primary) 18%, transparent);
        }
        .gbr-pricing-slider:focus-visible::-webkit-slider-thumb {
          box-shadow: 0 0 0 10px color-mix(in srgb, var(--color-marketing-primary) 24%, transparent);
        }
      `}</style>
    </section>
  );
}

function Row({
  label,
  value,
  suffix,
  tone = "default",
  emphasized = true,
}: {
  label: string;
  value: React.ReactNode;
  suffix?: string;
  tone?: "default" | "positive";
  emphasized?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 py-3">
      <span
        className="uppercase"
        style={{
          fontSize: "11px",
          letterSpacing: "0.18em",
          color: "var(--color-marketing-ink-muted)",
        }}
      >
        {label}
      </span>
      <span className="flex items-baseline gap-3">
        <span
          style={{
            fontSize: "clamp(20px, 2vw, 28px)",
            color:
              tone === "positive"
                ? "var(--color-marketing-primary)"
                : emphasized
                ? "var(--color-marketing-ink)"
                : "var(--color-marketing-ink-muted)",
            fontWeight: 500,
          }}
        >
          {value}
        </span>
        {suffix && (
          <span
            style={{
              fontSize: "12px",
              color: "var(--color-marketing-ink-subtle)",
            }}
          >
            {suffix}
          </span>
        )}
      </span>
    </div>
  );
}

function Divider() {
  return (
    <div
      role="presentation"
      style={{
        margin: "10px 0",
        height: 1,
        background: "var(--color-marketing-rule)",
      }}
    />
  );
}
