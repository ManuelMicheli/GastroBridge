"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap, SplitText, ScrollTrigger } from "@/lib/gsap-config";
import { EditorialEyebrow } from "./_primitives/editorial-eyebrow";
import { MOTION, prefersReducedMotion } from "@/lib/marketing-motion";

// v1 — single funnel "Il Problema". Loss-framing before the value pitch.
// No fabricated metrics: the contrast is the old fragmented workflow vs. GBR.
const OLD_CHANNELS = ["PDF allegati", "WhatsApp", "Telefono", "Fax", "Excel", "Post-it"] as const;

const PAINS = [
  { k: "PREZZI OPACHI", v: "li scopri in fattura" },
  { k: "NESSUNO STORICO", v: "ordini persi nel rumore" },
  { k: "ERRORI D'ORDINE", v: "righe sbagliate, resi" },
  { k: "TEMPO PERSO", v: "ore al telefono ogni settimana" },
] as const;

export function PromiseSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const painsRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (prefersReducedMotion()) {
      [headRef, bodyRef].forEach((r) => r.current && (r.current.style.opacity = "1"));
      panelRef.current
        ?.querySelectorAll<HTMLElement>("[data-line]")
        .forEach((el) => (el.style.opacity = "1"));
      painsRef.current
        ?.querySelectorAll<HTMLElement>("[data-pain]")
        .forEach((el) => (el.style.opacity = "1"));
      return;
    }

    const splits: SplitText[] = [];
    const ctx = gsap.context(() => {
      const trigger = { trigger: sectionRef.current, start: "top 70%", once: true };

      if (headRef.current) {
        const split = new SplitText(headRef.current, { type: "lines", linesClass: "pr-line" });
        splits.push(split);
        gsap.set(headRef.current, { opacity: 1 });
        gsap.fromTo(
          split.lines,
          { opacity: 0, y: 28 },
          {
            opacity: 1,
            y: 0,
            duration: MOTION.duration.revealLong,
            stagger: MOTION.stagger.line,
            ease: MOTION.easeEditorial,
            scrollTrigger: trigger,
          }
        );
      }

      if (bodyRef.current) {
        gsap.fromTo(
          bodyRef.current,
          { opacity: 0, y: 16 },
          {
            opacity: 1,
            y: 0,
            duration: MOTION.duration.revealBase,
            ease: MOTION.easeEditorial,
            scrollTrigger: { ...trigger, start: "top 72%" },
            delay: 0.25,
          }
        );
      }

      const lines = panelRef.current?.querySelectorAll<HTMLElement>("[data-line]");
      if (lines) {
        gsap.fromTo(
          lines,
          { opacity: 0, x: 12 },
          {
            opacity: 1,
            x: 0,
            duration: MOTION.duration.revealBase,
            stagger: 0.07,
            ease: MOTION.easeEditorial,
            scrollTrigger: { trigger: panelRef.current, start: "top 80%", once: true },
          }
        );
      }

      const pains = painsRef.current?.querySelectorAll<HTMLElement>("[data-pain]");
      if (pains) {
        gsap.fromTo(
          pains,
          { opacity: 0, y: 14 },
          {
            opacity: 1,
            y: 0,
            duration: MOTION.duration.revealBase,
            stagger: MOTION.stagger.block,
            ease: MOTION.easeEditorial,
            scrollTrigger: { trigger: painsRef.current, start: "top 82%", once: true },
          }
        );
      }

      ScrollTrigger.refresh();
    }, sectionRef);

    return () => {
      splits.forEach((s) => {
        try {
          s.revert();
        } catch {
          // ignore
        }
      });
      ctx.revert();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="problema"
      style={{
        paddingLeft: "var(--gutter-marketing)",
        paddingRight: "var(--gutter-marketing)",
        paddingTop: "var(--rhythm-section)",
        paddingBottom: "var(--rhythm-block)",
      }}
    >
      <div className="grid grid-cols-12 gap-y-12 gap-x-6 lg:gap-x-10 items-start">
        {/* left — the pain, in words */}
        <div className="col-span-12 lg:col-span-6">
          <EditorialEyebrow number="— 01">OGGI</EditorialEyebrow>

          <h2
            ref={headRef}
            className="font-display opacity-0 mt-[clamp(24px,3vw,40px)]"
            style={{
              fontSize: "var(--type-marketing-h2)",
              lineHeight: "var(--type-marketing-h2-lh)",
              letterSpacing: "var(--type-marketing-h2-ls)",
              color: "var(--color-marketing-ink)",
            }}
          >
            Ordinare non dovrebbe essere{" "}
            <span style={{ color: "var(--color-marketing-primary)" }}>
              una caccia al telefono.
            </span>
          </h2>

          <p
            ref={bodyRef}
            className="opacity-0 mt-[clamp(28px,3vw,44px)] max-w-[48ch]"
            style={{
              fontSize: "var(--type-marketing-pull)",
              lineHeight: "var(--type-marketing-pull-lh)",
              color: "var(--color-marketing-ink-muted)",
              fontFamily: "var(--font-display)",
            }}
          >
            Listini in PDF che invecchiano. Prezzi che scopri solo in fattura.
            Un food cost che non torna mai.
          </p>
        </div>

        {/* right — old method stack, struck, resolved into GBR */}
        <div className="col-span-12 lg:col-span-5 lg:col-start-8">
          <div
            ref={panelRef}
            className="font-mono"
            style={{
              border: "0.5px solid var(--color-marketing-rule-strong)",
              borderRadius: 8,
              overflow: "hidden",
              background: "var(--color-marketing-bg-soft)",
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{
                borderBottom: "0.5px solid var(--color-marketing-rule)",
                background: "var(--color-marketing-bg)",
              }}
            >
              <span
                className="uppercase"
                style={{
                  fontSize: "10px",
                  letterSpacing: "0.22em",
                  color: "var(--color-marketing-ink-subtle)",
                }}
              >
                COME ORDINI OGGI
              </span>
              <span style={{ fontSize: "10px", color: "var(--color-marketing-ink-subtle)" }}>
                6 canali
              </span>
            </div>

            <div className="px-5 py-5 space-y-3">
              {OLD_CHANNELS.map((c) => (
                <div
                  key={c}
                  data-line
                  className="opacity-0 flex items-center gap-3"
                  style={{ fontSize: "14px", color: "var(--color-marketing-ink-muted)" }}
                >
                  <span aria-hidden style={{ color: "var(--color-marketing-ink-subtle)" }}>
                    ✕
                  </span>
                  <span style={{ textDecoration: "line-through", textDecorationThickness: "1px" }}>
                    {c}
                  </span>
                </div>
              ))}

              <div
                data-line
                className="opacity-0 flex items-center gap-3 pt-4 mt-1"
                style={{
                  borderTop: "0.5px solid var(--color-marketing-rule)",
                  fontSize: "15px",
                }}
              >
                <span aria-hidden style={{ color: "var(--color-marketing-primary)" }}>
                  →
                </span>
                <span style={{ color: "var(--color-marketing-ink)", fontWeight: 500 }}>
                  GBR. Un posto solo.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* pains row */}
      <div
        ref={painsRef}
        className="mt-[clamp(64px,8vw,128px)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-10 gap-x-8 pt-10"
        style={{ borderTop: "1px solid var(--color-marketing-rule)" }}
      >
        {PAINS.map((p, i) => (
          <div key={p.k} data-pain className="opacity-0">
            <p
              className="font-mono uppercase mb-3 flex items-center gap-2"
              style={{
                fontSize: "10px",
                letterSpacing: "0.22em",
                color: "var(--color-marketing-ink-subtle)",
              }}
            >
              <span aria-hidden style={{ color: "var(--color-marketing-primary)" }}>
                ✕
              </span>
              0{i + 1}
            </p>
            <p
              className="font-mono uppercase mb-2"
              style={{
                fontSize: "13px",
                letterSpacing: "0.14em",
                color: "var(--color-marketing-ink)",
              }}
            >
              {p.k}
            </p>
            <p style={{ fontSize: "14px", lineHeight: 1.5, color: "var(--color-marketing-ink-muted)" }}>
              {p.v}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
