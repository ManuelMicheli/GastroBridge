import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Package, Users, BarChart3 } from "lucide-react";

export const metadata: Metadata = { title: "Analytics Fornitore" };

export default function SupplierAnalyticsPage() {
  return (
    <div>
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
        {[
          { label: "Fatturato mese", value: "€0", icon: TrendingUp },
          { label: "Prodotti venduti", value: "0", icon: Package },
          { label: "Clienti attivi", value: "0", icon: Users },
          { label: "Ordini mese", value: "0", icon: BarChart3 },
        ].map((stat) => (
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
  );
}
