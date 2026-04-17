"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { cn } from "@/lib/utils/formatters";

type Props = {
  name: string;
  showDateTime?: boolean;
  className?: string;
};

function greetingFor(hour: number): string {
  if (hour < 12) return "Buongiorno";
  if (hour < 19) return "Buon pomeriggio";
  return "Buonasera";
}

function formatItalianDateTime(d: Date): string {
  const day = d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${day} · h. ${hh}:${mm}`;
}

export function SerifGreeting({ name, showDateTime = true, className }: Props) {
  const reduced = useReducedMotion();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    if (!showDateTime) return;
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [showDateTime]);

  const hour = now?.getHours() ?? 12;
  const eyebrow = greetingFor(hour);

  if (reduced) {
    return (
      <div className={cn("space-y-1", className)}>
        <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-text-secondary">
          {eyebrow}
        </div>
        <h1 className="font-display text-3xl sm:text-4xl lg:text-[36px] leading-tight text-text-primary">
          {name}
          <span className="text-brand-primary">.</span>
        </h1>
        {showDateTime && now ? (
          <p className="text-xs text-text-secondary">{formatItalianDateTime(now)}</p>
        ) : null}
      </div>
    );
  }

  return (
    <motion.div
      className={cn("space-y-1", className)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-text-secondary">
        {eyebrow}
      </div>
      <h1 className="font-display text-3xl sm:text-4xl lg:text-[36px] leading-tight text-text-primary">
        {name}
        <span className="text-brand-primary">.</span>
      </h1>
      {showDateTime && now ? (
        <p className="text-xs text-text-secondary">{formatItalianDateTime(now)}</p>
      ) : null}
    </motion.div>
  );
}
