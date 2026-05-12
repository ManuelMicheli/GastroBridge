"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap-config";
import { MOTION, prefersReducedMotion } from "@/lib/marketing-motion";

type TickerItem = {
  label: string;
  value: number;
  format?: "int" | "currency" | "percent";
  prefix?: string;
  suffix?: string;
};

const ITEMS: readonly TickerItem[] = [
  { label: "VOL 24H", value: 127420, format: "currency" },
  { label: "TXN", value: 1247, format: "int" },
  { label: "SLA", value: 99.8, format: "percent" },
  { label: "MOM", value: 24.6, format: "percent", prefix: "▲ +" },
] as const;

function formatValue(item: TickerItem, current: number): string {
  if (item.format === "currency") {
    return "€" + Math.round(current).toLocaleString("it-IT");
  }
  if (item.format === "percent") {
    return current.toFixed(1) + "%";
  }
  return Math.round(current).toLocaleString("it-IT");
}

export function TickerBar() {
  const rootRef = useRef<HTMLDivElement>(null);
  const valueRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    if (prefersReducedMotion()) {
      ITEMS.forEach((item, i) => {
        const el = valueRefs.current[i];
        if (el) el.textContent = (item.prefix ?? "") + formatValue(item, item.value) + (item.suffix ?? "");
      });
      return;
    }

    const ctx = gsap.context(() => {
      const trigger = ScrollTrigger.create({
        trigger: rootRef.current,
        start: "top 85%",
        once: true,
        onEnter: () => {
          ITEMS.forEach((item, i) => {
            const el = valueRefs.current[i];
            if (!el) return;
            const state = { val: 0 };
            gsap.to(state, {
              val: item.value,
              duration: MOTION.duration.counter,
              ease: MOTION.easeEditorial,
              onUpdate: () => {
                el.textContent =
                  (item.prefix ?? "") + formatValue(item, state.val) + (item.suffix ?? "");
              },
            });
          });
        },
      });

      return () => trigger.kill();
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={rootRef}
      className="relative border-y font-mono"
      style={{
        borderColor: "var(--color-marketing-rule)",
        background: "var(--color-marketing-bg-soft)",
      }}
    >
      <div
        className="mx-auto flex items-center gap-x-8 gap-y-3 py-3.5 overflow-x-auto md:overflow-visible md:flex-wrap ticker-row"
        style={{
          paddingLeft: "var(--gutter-marketing)",
          paddingRight: "var(--gutter-marketing)",
          fontSize: "11px",
          letterSpacing: "0.14em",
          color: "var(--color-marketing-ink-muted)",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
          whiteSpace: "nowrap",
        }}
      >
        <span className="flex items-center gap-2 uppercase">
          <span aria-hidden className="ticker-pulse inline-block w-1.5 h-1.5 rounded-full" />
          <span style={{ color: "var(--color-marketing-ink)" }}>LIVE</span>
        </span>

        <span className="opacity-30" aria-hidden>|</span>

        <span className="uppercase" style={{ color: "var(--color-marketing-ink)" }}>
          GBR.NET
        </span>

        <span className="opacity-30" aria-hidden>|</span>

        {ITEMS.map((item, i) => (
          <span key={item.label} className="flex items-center gap-2 uppercase">
            <span className="opacity-70">{item.label}</span>
            <span
              ref={(el) => { valueRefs.current[i] = el; }}
              style={{ color: "var(--color-marketing-ink)" }}
            >
              {(item.prefix ?? "") + "0" + (item.suffix ?? "")}
            </span>
          </span>
        ))}

        <span className="ml-auto uppercase opacity-50 hidden md:inline">
          LAST UPDATE 14:23:07 CET
        </span>
      </div>

      <style jsx>{`
        .ticker-pulse {
          background: #1B6B4A;
          box-shadow: 0 0 0 0 rgba(27, 107, 74, 0.5);
          animation: tickerPulse 1.8s cubic-bezier(0.16, 1, 0.3, 1) infinite;
        }
        @keyframes tickerPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(27, 107, 74, 0.55);
          }
          70% {
            box-shadow: 0 0 0 8px rgba(27, 107, 74, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(27, 107, 74, 0);
          }
        }
        .ticker-row::-webkit-scrollbar {
          display: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .ticker-pulse {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
