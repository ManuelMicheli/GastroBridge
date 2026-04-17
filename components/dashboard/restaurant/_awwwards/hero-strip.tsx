// components/dashboard/restaurant/_awwwards/hero-strip.tsx
//
// Identity strip at the top of the restaurant dashboard.
// Terminal-dense caption row + display name + subtitle + live pulse dot.

"use client";

import { useEffect, useState } from "react";

function getGreeting(date: Date): string {
  const h = date.getHours();
  if (h < 5) return "Buonanotte";
  if (h < 12) return "Buongiorno";
  if (h < 18) return "Buon pomeriggio";
  return "Buonasera";
}

function formatISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatClock(d: Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function HeroStrip({
  companyName,
  subtitle,
}: {
  companyName: string;
  subtitle: string;
}) {
  // Render a neutral placeholder on first paint to avoid hydration churn,
  // then hydrate with the live greeting/date/time on the client.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const greeting = now ? getGreeting(now).toUpperCase() : "BENVENUTO";
  const isoDate = now ? formatISODate(now) : "——";
  const clock = now ? formatClock(now) : "——";

  return (
    <header className="animate-[fadeInUp_220ms_ease-out_both]">
      {/* caption row */}
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
          {greeting}
          <span className="mx-1.5 text-border-subtle">·</span>
          <span className="tabular-nums">{isoDate}</span>
          <span className="mx-1.5 text-border-subtle">·</span>
          <span className="tabular-nums">{clock}</span>
        </span>
        <span
          aria-hidden
          className="h-px flex-1 bg-border-subtle"
        />
        <span className="inline-flex items-center gap-1.5">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inset-0 rounded-full bg-accent-green opacity-75 animate-[livePulse_2s_ease-out_infinite]" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-green" />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
            Active
          </span>
        </span>
      </div>

      {/* display name */}
      <h1
        className="mt-4 font-display"
        style={{
          fontSize: "var(--text-display-lg)",
          lineHeight: "var(--text-display-lg--line-height)",
          letterSpacing: "var(--text-display-lg--letter-spacing)",
          fontWeight: "var(--text-display-lg--font-weight)",
          color: "var(--color-text-primary)",
        }}
      >
        {companyName}
      </h1>

      {/* subtitle */}
      <p
        className="mt-1.5 text-text-secondary"
        style={{
          fontSize: "var(--text-body-sm)",
          lineHeight: "var(--text-body-sm--line-height)",
        }}
      >
        {subtitle}
      </p>

      {/* Scoped keyframes (inline, no new globals) */}
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translate3d(0, 4px, 0);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }
        @keyframes livePulse {
          0% {
            transform: scale(1);
            opacity: 0.75;
          }
          80% {
            transform: scale(2.4);
            opacity: 0;
          }
          100% {
            transform: scale(2.4);
            opacity: 0;
          }
        }
      `}</style>
    </header>
  );
}
