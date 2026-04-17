import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import Link from "next/link";
import { User, MapPin, Users, CreditCard, ChevronRight, SlidersHorizontal, Target } from "lucide-react";

export const metadata: Metadata = { title: "Impostazioni" };

const SETTINGS_SECTIONS = [
  { href: "/impostazioni", label: "Profilo", description: "Dati azienda, P.IVA, contatti", icon: User },
  { href: "/impostazioni/sedi", label: "Sedi", description: "Gestisci i tuoi ristoranti", icon: MapPin },
  { href: "/impostazioni/esigenze-fornitura", label: "Esigenze di fornitura", description: "Vincoli, priorità e profilo di acquisto", icon: SlidersHorizontal },
  { href: "/impostazioni/budget", label: "Budget mensile", description: "Tetto di spesa per tracking analytics", icon: Target },
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
      <PageHeader
        title="Impostazioni"
        subtitle="Gestisci profilo, sedi, team e parametri della piattaforma."
      />

      <SectionHeader title="Sezioni" />
      <div
        className="cq-section grid gap-3 mb-10"
        style={{
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(300px, 100%), 1fr))",
        }}
      >
        {SETTINGS_SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="block focus-ring rounded-2xl"
          >
            <Card className="motion-lift hover:shadow-elevated transition-shadow min-h-[80px]">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-sage-muted/20 rounded-lg shrink-0">
                  <section.icon className="h-5 w-5 text-forest" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-charcoal">{section.label}</h3>
                  <p className="text-sm text-sage truncate">{section.description}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-sage shrink-0" />
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <SectionHeader title="Profilo Azienda" />
      <Card>
        <CardHeader><CardTitle>Dati anagrafici</CardTitle></CardHeader>
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
