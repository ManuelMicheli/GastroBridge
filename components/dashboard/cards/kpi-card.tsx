"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Sparkline } from "../charts/sparkline";
import type { LucideIcon } from "lucide-react";

type Props = {
  label: string;
  value: string;
  numericValue?: number;
  previousValue?: number;
  icon: LucideIcon;
  sparklineData?: number[];
  accentColor?: string;
};

export function KPICard({
  label,
  value,
  numericValue,
  previousValue,
  icon: Icon,
  sparklineData,
  accentColor = "var(--color-accent-green)",
}: Props) {
  const valueRef = useRef<HTMLParagraphElement>(null);

  // Animate number counting
  useEffect(() => {
    if (!numericValue || !valueRef.current) return;

    const el = valueRef.current;
    const start = 0;
    const end = numericValue;
    const duration = 1200;
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out expo
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * eased;

      if (el) {
        // Format based on whether value contains €
        if (value.includes("€")) {
          el.textContent = `€${Math.round(current).toLocaleString("it-IT")}`;
        } else {
          el.textContent = Math.round(current).toLocaleString("it-IT");
        }
      }

      if (progress < 1) requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }, [numericValue, value]);

  // Trend calculation
  const trend =
    previousValue !== undefined && previousValue > 0 && numericValue !== undefined
      ? ((numericValue - previousValue) / previousValue) * 100
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-card-dark hover:border-border-accent hover:shadow-[var(--glow-forest)] transition-all group"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Icon + label */}
          <div className="flex items-center gap-2 mb-3">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 12%, transparent)` }}
            >
              <Icon className="h-4 w-4" style={{ color: accentColor }} />
            </div>
            <span className="text-xs font-medium text-text-primary uppercase tracking-wider">
              {label}
            </span>
          </div>

          {/* Value */}
          <p ref={valueRef} className="text-2xl font-mono font-bold text-text-primary">
            {value}
          </p>

          {/* Trend */}
          {trend !== null && (
            <div className="flex items-center gap-1 mt-1.5">
              {trend >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-accent-green" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-accent-orange" />
              )}
              <span
                className={`text-xs font-medium ${
                  trend >= 0 ? "text-accent-green" : "text-accent-orange"
                }`}
              >
                {trend >= 0 ? "+" : ""}
                {trend.toFixed(1)}%
              </span>
              <span className="text-xs text-text-tertiary">vs mese prec.</span>
            </div>
          )}
        </div>

        {/* Sparkline */}
        {sparklineData && sparklineData.length > 1 && (
          <div className="ml-3 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
            <Sparkline data={sparklineData} width={72} height={36} color={accentColor} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
