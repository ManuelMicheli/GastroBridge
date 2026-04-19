import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Package, Users, BarChart3 } from "lucide-react";
import { LargeTitle } from "@/components/ui/large-title";
import { GroupedList, GroupedListRow } from "@/components/ui/grouped-list";

export const metadata: Metadata = { title: "Analytics Fornitore" };

type StatRow = {
  label: string;
  value: string;
  icon: typeof TrendingUp;
  color: string;
};

export default function SupplierAnalyticsPage() {
  const stats: StatRow[] = [
    { label: "Fatturato mese", value: "€0", icon: TrendingUp, color: "#A87535" },
    { label: "Prodotti venduti", value: "0", icon: Package, color: "#5C3F18" },
    { label: "Clienti attivi", value: "0", icon: Users, color: "#2B6F42" },
    { label: "Ordini mese", value: "0", icon: BarChart3 , color: "#7A5B18" },
  ];

  return (
    <>
      {/* Mobile Apple-app view */}
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

      {/* Desktop view */}
      <div className="hidden lg:block">
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <h1
            className="font-display text-text-primary"
            style={{
              fontSize: "var(--text-display-lg, 28px)",
              lineHeight: "var(--text-display-lg--line-height, 1.2)",
            }}
          >
            Analytics<span className="text-brand-primary">.</span>
          </h1>
          <Badge variant="success">Growth+</Badge>
        </div>

        <div
          className="cq-section grid gap-4 mb-8"
          style={{
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
          }}
        >
          {stats.map((stat) => (
            <Card key={stat.label}>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-forest-light rounded-xl">
                  <stat.icon className="h-6 w-6 text-forest" />
                </div>
                <div>
                  <p className="text-2xl font-mono font-bold">{stat.value}</p>
                  <p className="text-sm text-sage">{stat.label}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div
          className="cq-section grid gap-6"
          style={{
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
          }}
        >
          <Card>
            <h3 className="font-bold text-charcoal mb-4">Revenue per Mese</h3>
            <div className="h-64 flex items-center justify-center bg-sage-muted/10 rounded-xl">
              <p className="text-sage text-sm">Grafico disponibile dopo i primi ordini</p>
            </div>
          </Card>
          <Card>
            <h3 className="font-bold text-charcoal mb-4">Top Prodotti</h3>
            <div className="h-64 flex items-center justify-center bg-sage-muted/10 rounded-xl">
              <p className="text-sage text-sm">Dati disponibili dopo i primi ordini</p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
