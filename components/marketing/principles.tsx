"use client";

import { useRef, useEffect } from "react";
import { gsap } from "@/lib/gsap-config";
import { EditorialEyebrow } from "./_primitives/editorial-eyebrow";
import { MOTION, prefersReducedMotion } from "@/lib/marketing-motion";

const PRINCIPLES = [
  {
    number: "I.",
    title: "Trasparenza radicale",
    body:
      "Ogni prezzo è pubblico. Ogni commissione è dichiarata. Non guadagniamo sulle transazioni dei ristoratori — solo sui piani dei fornitori. Nessun conflitto di interesse.",
  },
  {
    number: "II.",
    title: "Niente intermediari",
    body:
      "Non compriamo né rivendiamo merce. Non facciamo dropshipping. Colleghiamo direttamente chi vende a chi cucina, e basta. La relazione commerciale è tra loro.",
  },
  {
    number: "III.",
    title: "Italia, filiera corta",
    body:
      "Selezioniamo solo fornitori italiani verificati. Priorità alle produzioni locali, alle DOP, alle filiere tracciabili. Un ristorante a Milano può trovare il suo casaro a venti chilometri.",
  },
  {
    number: "IV.",
    title: "Strumento, non piattaforma di marketing",
    body:
      "Non esistiamo per piazzare più ordini. Esistiamo per far risparmiare tempo e restituirlo alla cucina. Se un fornitore ti serve meglio offline, è giusto che tu stia con lui.",
  },
];

export function Principles() {
  const sectionRef = useRef<HTMLElement>(null);
  const itemsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const els = itemsRef.current.filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;

    if (prefersReducedMotion()) {
      els.forEach((el) => (el.style.opacity = "1"));
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        els,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: MOTION.duration.revealBase,
          stagger: MOTION.stagger.block,
          ease: MOTION.easeEditorial,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: MOTION.scrollTrigger.defaultStart,
            once: true,
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="principi"
      style={{
        paddingLeft: "var(--gutter-marketing)",
        paddingRight: "var(--gutter-marketing)",
        paddingTop: "var(--rhythm-section)",
        paddingBottom: "var(--rhythm-section)",
        background: "var(--color-marketing-bg-soft)",
      }}
    >
      <div className="grid grid-cols-12 gap-y-12 gap-x-6 lg:gap-x-10 mb-[clamp(48px,6vw,96px)]">
        <div className="col-span-12 lg:col-span-4">
          <EditorialEyebrow number="— 05">PRINCIPI</EditorialEyebrow>
          <p
            className="mt-8 max-w-[30ch]"
            style={{
              fontSize: "13px",
              lineHeight: 1.6,
              color: "var(--color-marketing-ink-subtle)",
            }}
          >
            Quattro regole che non negoziamo. Quando abbiamo un dubbio,
            torniamo a queste.
          </p>
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
          Come lavoriamo
          <br />
          e su cosa non cediamo.
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-y-16 gap-x-10 lg:gap-x-16">
        {PRINCIPLES.map((p, i) => (
          <div
            key={p.number}
            ref={(el) => {
              itemsRef.current[i] = el;
            }}
            className="opacity-0 flex flex-col"
            style={{
              borderTop: "1px solid var(--color-marketing-rule-strong)",
              paddingTop: "clamp(24px, 3vw, 40px)",
            }}
          >
            <p
              className="font-display mb-6"
              style={{
                fontSize: "clamp(40px, 4vw, 56px)",
                lineHeight: 1,
                letterSpacing: "-0.02em",
                color: "var(--color-marketing-primary)",
              }}
            >
              {p.number}
            </p>
            <h3
              className="font-display mb-5"
              style={{
                fontSize: "clamp(24px, 2.4vw, 32px)",
                lineHeight: "1.1",
                letterSpacing: "-0.02em",
                color: "var(--color-marketing-ink)",
              }}
            >
              {p.title}
            </h3>
            <p
              className="max-w-[44ch]"
              style={{
                fontSize: "16px",
                lineHeight: "1.6",
                color: "var(--color-marketing-ink-muted)",
              }}
            >
              {p.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
