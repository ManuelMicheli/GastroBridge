import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { ClipboardList, TrendingUp, Users, Package } from "lucide-react";

export const metadata: Metadata = { title: "Dashboard Fornitore" };

export default async function SupplierDashboardPage() {
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
        Ciao, {profile?.company_name || "Fornitore"}
      </h1>
      <p className="text-sage mb-8">Ecco il riepilogo della tua attivita.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Ordini oggi", value: "0", icon: ClipboardList, color: "text-forest" },
          { label: "Fatturato mese", value: "€0", icon: TrendingUp, color: "text-terracotta" },
          { label: "Clienti attivi", value: "0", icon: Users, color: "text-forest" },
          { label: "Prodotti attivi", value: "0", icon: Package, color: "text-charcoal" },
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
          <h3 className="font-bold text-charcoal mb-4">Ordini recenti</h3>
          <p className="text-sage text-sm">Nessun ordine ricevuto ancora.</p>
        </Card>
        <Card>
          <h3 className="font-bold text-charcoal mb-4">Prodotti piu richiesti</h3>
          <p className="text-sage text-sm">I dati saranno disponibili dopo i primi ordini.</p>
        </Card>
      </div>
    </div>
  );
}
