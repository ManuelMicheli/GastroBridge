"use client";

// v1 — factual strip. No fabricated metrics (the old animated VOL/TXN/SLA/MoM
// counters were invented) and no payment claims. Just what the tool does.
const FACTS: readonly string[] = [
  "I TUOI FORNITORI",
  "I TUOI CATALOGHI",
  "IMPORT CSV / EXCEL",
  "ORDINI IN 90 SECONDI",
  "STORICO + EXPORT",
  "NESSUN LOCK-IN",
] as const;

export function TickerBar() {
  return (
    <div
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
          <span style={{ color: "var(--color-marketing-ink)" }}>GBR</span>
        </span>

        <span className="opacity-30" aria-hidden>|</span>

        {FACTS.map((fact, i) => (
          <span key={fact} className="flex items-center gap-8 uppercase">
            {i > 0 && <span className="opacity-30" aria-hidden>·</span>}
            <span style={{ color: "var(--color-marketing-ink)" }}>{fact}</span>
          </span>
        ))}
      </div>

      <style jsx>{`
        .ticker-pulse {
          background: var(--color-marketing-primary);
          box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-marketing-primary) 50%, transparent);
          animation: tickerPulse 1.8s cubic-bezier(0.16, 1, 0.3, 1) infinite;
        }
        @keyframes tickerPulse {
          0% {
            box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-marketing-primary) 55%, transparent);
          }
          70% {
            box-shadow: 0 0 0 8px color-mix(in srgb, var(--color-marketing-primary) 0%, transparent);
          }
          100% {
            box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-marketing-primary) 0%, transparent);
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
