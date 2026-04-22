"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/formatters";
import { RESTAURANT_PLANS, SUPPLIER_PLANS, type PlanDefinition } from "@/lib/utils/constants";

function PlanCard({ plan, role }: { plan: PlanDefinition; role: string }) {
  const highlighted = !!plan.highlighted;
  return (
    <div
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
          Più scelto
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
          {plan.price === 0 ? "—" : `€${plan.price}`}
        </span>
        {plan.price > 0 && (
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
        )}
        {plan.price === 0 && (
          <span
            className="font-mono uppercase"
            style={{
              fontSize: "11px",
              letterSpacing: "0.2em",
              color: "var(--color-marketing-ink-subtle)",
            }}
          >
            Gratis
          </span>
        )}
      </div>

      <ul className="space-y-3 mb-10 flex-1">
        {plan.features.map((feature) => (
          <li
            key={feature}
            className="flex items-baseline gap-3"
            style={{
              fontSize: "15px",
              lineHeight: "1.5",
              color: "var(--color-marketing-ink)",
            }}
          >
            <span
              aria-hidden
              style={{ color: "var(--color-marketing-primary)" }}
              className="font-display"
            >
              —
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Link
        href={`/signup?role=${role}&plan=${plan.id}`}
        className={cn(
          "inline-flex items-center justify-center w-full py-3 text-[14px] tracking-wide transition-colors",
          highlighted ? "rounded-full" : ""
        )}
        style={
          highlighted
            ? {
                background: "var(--color-marketing-primary)",
                color: "var(--color-marketing-on-primary)",
              }
            : {
                border: "1px solid var(--color-marketing-rule-strong)",
                color: "var(--color-marketing-ink)",
                borderRadius: "9999px",
              }
        }
      >
        {plan.price === 0 ? "Inizia" : "Scegli piano"} →
      </Link>
    </div>
  );
}

export function PricingTable() {
  const [tab, setTab] = useState<"restaurant" | "supplier">("restaurant");
  const plans = tab === "restaurant" ? RESTAURANT_PLANS : SUPPLIER_PLANS;

  return (
    <div {...(tab === "supplier" ? { "data-side": "supplier" } : {})}>
      {/* Tab switcher */}
      <div
        className="flex items-center gap-10 mb-16"
        role="tablist"
        aria-label="Filtro piani"
      >
        {([
          { key: "restaurant" as const, label: "Per ristoratori" },
          { key: "supplier" as const, label: "Per fornitori" },
        ]).map((entry) => {
          const active = tab === entry.key;
          return (
            <button
              key={entry.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(entry.key)}
              className="relative pb-2 font-mono uppercase tracking-[0.18em] text-[12px] transition-colors"
              style={{
                color: active
                  ? "var(--color-marketing-ink)"
                  : "var(--color-marketing-ink-subtle)",
              }}
            >
              {entry.label}
              {active && (
                <span
                  aria-hidden
                  className="absolute left-0 bottom-0 h-px w-full"
                  style={{ background: "var(--color-marketing-primary)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-[1px]">
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} role={tab} />
        ))}
      </div>
    </div>
  );
}
