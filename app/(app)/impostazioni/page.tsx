import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { User, MapPin, Users, CreditCard, ChevronRight } from "lucide-react";

export const metadata: Metadata = { title: "Impostazioni" };

const SETTINGS_SECTIONS = [
  { href: "/impostazioni", label: "Profilo", description: "Dati azienda, P.IVA, contatti", icon: User },
  { href: "/impostazioni/sedi", label: "Sedi", description: "Gestisci i tuoi ristoranti", icon: MapPin },
  { href: "/impostazioni/team", label: "Team", description: "Membri del team", icon: Users },
  { href: "/impostazioni/abbonamento", label: "Abbonamento", description: "Piano e fatturazione", icon: CreditCard },
];

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user?.id ?? "")
    .single<{ company_name: string; vat_number: string | null; city: string | null; phone: string | null }>();

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal mb-6">Impostazioni</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {SETTINGS_SECTIONS.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="hover:shadow-elevated transition-shadow">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-sage-muted/20 rounded-xl">
                  <section.icon className="h-5 w-5 text-forest" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-charcoal">{section.label}</h3>
                  <p className="text-sm text-sage">{section.description}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-sage" />
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Profilo Azienda</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-sage-muted/20">
              <span className="text-sage">Azienda</span>
              <span className="font-semibold">{profile?.company_name ?? "—"}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-sage-muted/20">
              <span className="text-sage">P.IVA</span>
              <span className="font-semibold">{profile?.vat_number ?? "—"}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-sage-muted/20">
              <span className="text-sage">Citta</span>
              <span className="font-semibold">{profile?.city ?? "—"}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-sage">Telefono</span>
              <span className="font-semibold">{profile?.phone ?? "—"}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
