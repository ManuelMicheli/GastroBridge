import type { Metadata } from "next";
import Link from "next/link";
import {
  Bell,
  ChevronRight,
  CreditCard,
  MapPin,
  Sparkles,
  Warehouse,
} from "lucide-react";
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
      label: "Zone di consegna",
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
      {/* Mobile — untouched */}
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

      {/* Desktop — settings terminal */}
      <div className="hidden lg:block">
        <div className="flex flex-col gap-8">
          {/* Terminal header */}
          <header>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
                Impostazioni · account fornitore · configurazione
              </span>
              <span aria-hidden className="h-px flex-1 bg-border-subtle" />
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
                {sections.length} sezioni
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
              Impostazioni
            </h1>
            <p className="mt-1.5 text-sm text-text-secondary">
              Configura profilo, sedi, zone di consegna, notifiche e
              abbonamento.
            </p>
          </header>

          <SettingsGroup index="01" title="Brand" items={brand} />
          <SettingsGroup index="02" title="Operativo" items={operativo} />
          <SettingsGroup index="03" title="Account" items={account} />

          <div className="pt-2">
            <Link
              href="/logout"
              className="inline-flex items-center gap-2 border-b border-border-subtle pb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-text-secondary transition-colors hover:border-accent-red hover:text-accent-red"
            >
              Esci dalla sessione →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

function SettingsGroup({
  index,
  title,
  items,
}: {
  index: string;
  title: string;
  items: Section[];
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <header className="flex items-center gap-3">
        <span
          aria-hidden
          className="font-mono tabular-nums leading-none select-none text-text-tertiary/70"
          style={{ fontSize: "22px", fontWeight: 300, letterSpacing: "-0.02em" }}
        >
          {index}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-primary">
          ▸ {title.toUpperCase()}
        </span>
        <span aria-hidden className="h-px flex-1 bg-border-subtle" />
      </header>
      <ul className="flex flex-col divide-y divide-border-subtle/60 rounded-xl border border-border-subtle bg-surface-card">
        {items.map((s, i) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="group grid w-full grid-cols-[28px_minmax(0,1fr)_12px] items-center gap-x-4 border-l-2 border-transparent px-4 text-left transition-colors hover:border-accent-green hover:bg-surface-hover"
              style={{ minHeight: 64 }}
            >
              <span className="font-mono text-[11px] tabular-nums text-text-tertiary">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-text-primary">
                  {s.label}
                </span>
                <span className="truncate text-[13px] text-text-secondary">
                  {s.description}
                </span>
              </span>
              <ChevronRight
                className="h-4 w-4 text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
