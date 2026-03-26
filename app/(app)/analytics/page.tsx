import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingDown, PieChart, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Analytics Spesa</h1>
          <Badge variant="success" className="mt-1">Pro+</Badge>
        </div>
        <Button variant="secondary" size="sm">
          <Download className="h-4 w-4" /> Esporta CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Spesa questo mese", value: "€0", icon: BarChart3, delta: "0%" },
          { label: "Risparmio trovato", value: "€0", icon: TrendingDown, delta: "0%" },
          { label: "Categorie ordinate", value: "0", icon: PieChart, delta: "" },
        ].map((stat) => (
          <Card key={stat.label}>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-forest-light rounded-xl">
                <stat.icon className="h-6 w-6 text-forest" />
              </div>
              <div>
                <p className="text-2xl font-mono font-bold text-charcoal">{stat.value}</p>
                <p className="text-sm text-sage">{stat.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-bold text-charcoal mb-4">Spesa per Categoria</h3>
          <div className="h-64 flex items-center justify-center bg-sage-muted/10 rounded-xl">
            <p className="text-sage text-sm">Grafico disponibile dopo i primi ordini</p>
          </div>
        </Card>
        <Card>
          <h3 className="font-bold text-charcoal mb-4">Trend Prezzi</h3>
          <div className="h-64 flex items-center justify-center bg-sage-muted/10 rounded-xl">
            <p className="text-sage text-sm">Trend disponibili dopo i primi acquisti</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
