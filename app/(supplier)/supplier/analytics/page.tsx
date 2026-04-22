import type { Metadata } from "next";
import { BarChart3, Package, TrendingUp, Users } from "lucide-react";
import { LargeTitle } from "@/components/ui/large-title";
import { GroupedList, GroupedListRow } from "@/components/ui/grouped-list";
import { SectionFrame } from "@/components/dashboard/supplier/_awwwards/section-frame";

export const metadata: Metadata = { title: "Analytics Fornitore" };

type StatRow = {
  label: string;
  value: string;
  icon: typeof TrendingUp;
  color: string;
  hint: string;
  accent: string;
};

export default function SupplierAnalyticsPage() {
  const stats: StatRow[] = [
    {
      label: "Fatturato mese",
      value: "€0",
      icon: TrendingUp,
      color: "#A87535",
      hint: "vs mese scorso",
      accent: "var(--color-accent-green)",
    },
    {
      label: "Prodotti venduti",
      value: "0",
      icon: Package,
      color: "#5C3F18",
      hint: "unità totali",
      accent: "var(--color-accent-amber)",
    },
    {
      label: "Clienti attivi",
      value: "0",
      icon: Users,
      color: "#2B6F42",
      hint: "ristoranti collegati",
      accent: "var(--color-accent-blue)",
    },
    {
      label: "Ordini mese",
      value: "0",
      icon: BarChart3,
      color: "#7A5B18",
      hint: "split processati",
      accent: "var(--color-accent-purple)",
    },
  ];

  return (
    <>
      {/* Mobile Apple-app view — untouched */}
      <div className="lg:hidden pb-4">
        <LargeTitle
          eyebrow="Performance mese"
          title="Analytics"
          subtitle="KPI, trend e top prodotti"
        />

        <GroupedList className="mt-3" label="Riepilogo">
          {stats.map((s) => (
            <GroupedListRow
              key={s.label}
              leading={
                <div
                  className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-white"
                  style={{ background: s.color }}
                  aria-hidden
                >
                  <s.icon className="h-3.5 w-3.5" />
                </div>
              }
              title={s.label}
              trailing={
                <span
                  className="font-serif text-[16px] font-medium text-[color:var(--color-brand-primary)]"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  {s.value}
                </span>
              }
            />
          ))}
        </GroupedList>

        <div className="mx-[10px] mt-3 rounded-xl bg-[color:var(--ios-surface)] p-4 shadow-[0_0.5px_0_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[color:var(--caption-color)]">
            Revenue per mese
          </div>
          <p className="mt-3 text-center text-[13px] text-[color:var(--text-muted-light,#6B6B6B)]">
            Grafico disponibile dopo i primi ordini
          </p>
        </div>

        <div className="mx-[10px] mt-2 rounded-xl bg-[color:var(--ios-surface)] p-4 shadow-[0_0.5px_0_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[color:var(--caption-color)]">
            Top prodotti
          </div>
          <p className="mt-3 text-center text-[13px] text-[color:var(--text-muted-light,#6B6B6B)]">
            Dati disponibili dopo i primi ordini
          </p>
        </div>
      </div>

      {/* Desktop — analyst workbench terminal */}
      <div className="hidden lg:block">
        <div className="flex flex-col gap-6">
          {/* Terminal header */}
          <header>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
                Analytics · workbench · performance operativa
              </span>
              <span aria-hidden className="h-px flex-1 bg-border-subtle" />
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-accent-green">
                Growth+ · live
              </span>
            </div>
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
              Analytics
            </h1>
            <p className="mt-1.5 text-sm text-text-secondary">
              KPI del mese, trend fatturato, classifica prodotti e clienti.
            </p>
          </header>

          {/* KPI frame */}
          <SectionFrame
            label="KPI · questo mese"
            trailing="as of now"
            padded={false}
          >
            <div className="grid gap-3 p-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))" }}>
              {stats.map((stat, i) => (
                <article
                  key={stat.label}
                  className="group relative overflow-hidden rounded-xl border border-border-subtle bg-surface-card px-4 pt-3.5 pb-3 transition-colors hover:border-border-accent"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--color-text-tertiary) 14%, transparent) 1px, transparent 0)",
                    backgroundSize: "14px 14px",
                  }}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute right-2 top-2 h-2.5 w-2.5 border-r border-t border-border-subtle opacity-60 transition-[opacity,border-color] duration-200 group-hover:border-accent-green group-hover:opacity-100"
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute bottom-2 left-2 h-2.5 w-2.5 border-b border-l border-border-subtle opacity-60 transition-[opacity,border-color] duration-200 group-hover:border-accent-green group-hover:opacity-100"
                  />
                  <div className="flex flex-col gap-1.5">
                    <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
                      <span className="text-text-tertiary/70 tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span aria-hidden className="text-border-subtle">
                        ·
                      </span>
                      <span className="truncate">{stat.label}</span>
                    </span>
                    <span
                      className="font-mono tabular-nums text-text-primary"
                      style={{
                        fontSize: "var(--text-display-lg, 28px)",
                        lineHeight: "var(--text-display-lg--line-height, 32px)",
                        letterSpacing:
                          "var(--text-display-lg--letter-spacing, -0.011em)",
                        fontWeight: 500,
                      }}
                    >
                      {stat.value}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-tertiary">
                      {stat.hint}
                    </span>
                  </div>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-px scale-x-0 bg-gradient-to-r from-transparent via-accent-green to-transparent transition-transform duration-500 ease-out group-hover:scale-x-100"
                  />
                </article>
              ))}
            </div>
          </SectionFrame>

          {/* Two-up frames: trend + top prodotti */}
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(360px, 100%), 1fr))",
            }}
          >
            <SectionFrame
              label="Trend · fatturato mensile"
              trailing="ultimi 6 mesi"
              padded={false}
            >
              <div className="flex h-64 flex-col items-center justify-center gap-2 px-4 py-6 text-center">
                <TrendingUp
                  className="h-5 w-5 text-text-tertiary"
                  aria-hidden
                />
                <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
                  Grafico disponibile dopo i primi ordini
                </p>
                <p className="text-[12px] text-text-secondary">
                  I dati si popolano automaticamente man mano che ricevi ordini.
                </p>
              </div>
            </SectionFrame>

            <SectionFrame
              label="Classifica · top prodotti"
              trailing="ranked by revenue"
              padded={false}
            >
              <div className="flex h-64 flex-col items-center justify-center gap-2 px-4 py-6 text-center">
                <Package className="h-5 w-5 text-text-tertiary" aria-hidden />
                <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
                  Dati disponibili dopo i primi ordini
                </p>
                <p className="text-[12px] text-text-secondary">
                  La classifica mostra i prodotti più richiesti dai tuoi
                  clienti.
                </p>
              </div>
            </SectionFrame>
          </div>
        </div>
      </div>
    </>
  );
}
