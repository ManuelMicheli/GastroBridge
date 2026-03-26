import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ShoppingCart, TrendingDown, Store, ClipboardList } from "lucide-react";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_name")
    .eq("id", user?.id ?? "")
    .single<{ company_name: string }>();

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal mb-1">
        Ciao, {profile?.company_name || "Ristoratore"}
      </h1>
      <p className="text-sage mb-8">Ecco il riepilogo della tua attivita.</p>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Ordini questo mese", value: "0", icon: ClipboardList, color: "text-forest" },
          { label: "Spesa totale", value: "€0", icon: ShoppingCart, color: "text-terracotta" },
          { label: "Risparmio stimato", value: "€0", icon: TrendingDown, color: "text-forest" },
          { label: "Fornitori attivi", value: "0", icon: Store, color: "text-charcoal" },
        ].map((stat) => (
          <Card key={stat.label}>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-sage-muted/20 rounded-xl">
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
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
          <CardHeader>
            <CardTitle>Ordini recenti</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sage text-sm">Nessun ordine ancora. Inizia a cercare prodotti!</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Alert Risparmio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sage text-sm">Gli alert saranno disponibili dopo i primi ordini.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
