import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { MapPin, CreditCard, ChevronRight, Warehouse, Bell, Sparkles } from "lucide-react";
import { LargeTitle } from "@/components/ui/large-title";
import { GroupedList, GroupedListRow } from "@/components/ui/grouped-list";

export const metadata: Metadata = { title: "Impostazioni Fornitore" };

type Section = {
  href: string;
  label: string;
  description: string;
  icon: typeof Sparkles;
  color: string;
  group: "brand" | "operativo" | "account";
};

export default function SupplierSettingsPage() {
  const sections: Section[] = [
    {
      href: "/supplier/impostazioni/profilo",
      label: "Profilo pubblico",
      description: "Logo, copertina e descrizione visibili ai ristoratori",
      icon: Sparkles,
      color: "#A87535",
      group: "brand",
    },
    {
      href: "/supplier/impostazioni/sedi",
      label: "Sedi / Magazzini",
      description: "Gestisci i magazzini e la sede principale",
      icon: Warehouse,
      color: "#5C3F18",
      group: "operativo",
    },
    {
      href: "/supplier/impostazioni/zone",
      label: "Zone di Consegna",
      description: "Gestisci province e CAP di consegna",
      icon: MapPin,
      color: "#2B6F42",
      group: "operativo",
    },
    {
      href: "/supplier/impostazioni/notifiche",
      label: "Notifiche",
      description: "Push browser e canali di avviso",
      icon: Bell,
      color: "#A87535",
      group: "operativo",
    },
    {
      href: "/supplier/impostazioni/abbonamento",
      label: "Abbonamento",
      description: "Piano e fatturazione",
      icon: CreditCard,
      color: "#6B5D5F",
      group: "account",
    },
  ];

  const brand = sections.filter((s) => s.group === "brand");
  const operativo = sections.filter((s) => s.group === "operativo");
  const account = sections.filter((s) => s.group === "account");

  return (
    <>
      {/* Mobile Apple-app view */}
      <div className="lg:hidden pb-4">
        <LargeTitle
          eyebrow="Account fornitore"
          title="Impostazioni"
          subtitle="Profilo, zone, magazzini e notifiche"
        />

        <GroupedList className="mt-3" label="Brand">
          {brand.map((s) => (
            <GroupedListRow
              key={s.href}
              href={s.href}
              leading={
                <div
                  className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-white"
                  style={{ background: s.color }}
                >
                  <s.icon className="h-3.5 w-3.5" />
                </div>
              }
              title={s.label}
              subtitle={s.description}
              showChevron
            />
          ))}
        </GroupedList>

        <GroupedList className="mt-2" label="Operativo">
          {operativo.map((s) => (
            <GroupedListRow
              key={s.href}
              href={s.href}
              leading={
                <div
                  className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-white"
                  style={{ background: s.color }}
                >
                  <s.icon className="h-3.5 w-3.5" />
                </div>
              }
              title={s.label}
              subtitle={s.description}
              showChevron
            />
          ))}
        </GroupedList>

        <GroupedList className="mt-2" label="Account">
          {account.map((s) => (
            <GroupedListRow
              key={s.href}
              href={s.href}
              leading={
                <div
                  className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-white"
                  style={{ background: s.color }}
                >
                  <s.icon className="h-3.5 w-3.5" />
                </div>
              }
              title={s.label}
              subtitle={s.description}
              showChevron
            />
          ))}
        </GroupedList>

        <GroupedList className="mt-6">
          <GroupedListRow
            href="/logout"
            title={
              <span className="block w-full text-center font-medium text-[#C93737]">
                Esci
              </span>
            }
          />
        </GroupedList>
      </div>

      {/* Desktop view */}
      <div className="hidden lg:block">
        <h1 className="font-display text-3xl text-text-primary mb-6">
          Impostazioni<span className="text-brand-primary">.</span>
        </h1>
        <div className="space-y-3">
          {sections.map((s) => (
            <Link key={s.href} href={s.href}>
              <Card className="hover:shadow-elevated transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-sage-muted/20 rounded-xl">
                    <s.icon className="h-5 w-5 text-forest" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-charcoal">{s.label}</h3>
                    <p className="text-sm text-sage">{s.description}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-sage" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
