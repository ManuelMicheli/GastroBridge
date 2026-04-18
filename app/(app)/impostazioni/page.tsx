import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { SectionFrame } from "@/components/dashboard/restaurant/_awwwards/section-frame";
import { SettingsNavRow } from "./_components/settings-nav-row";

export const metadata: Metadata = { title: "Impostazioni" };

const SETTINGS_SECTIONS = [
  {
    href: "#profilo",
    label: "Profilo",
    description: "Dati azienda, P.IVA, contatti",
  },
  {
    href: "/impostazioni/sedi",
    label: "Sedi",
    description: "Gestisci i tuoi ristoranti",
  },
  {
    href: "/impostazioni/notifiche",
    label: "Notifiche",
    description: "Canali, push browser e avvisi in tempo reale",
  },
  {
    href: "/impostazioni/esigenze-fornitura",
    label: "Esigenze di fornitura",
    description: "Vincoli, priorità e profilo di acquisto",
  },
  {
    href: "/impostazioni/budget",
    label: "Budget mensile",
    description: "Tetto di spesa per tracking analytics",
  },
  {
    href: "/impostazioni/team",
    label: "Team",
    description: "Membri del team",
  },
  {
    href: "/impostazioni/abbonamento",
    label: "Abbonamento",
    description: "Piano e fatturazione",
  },
] as const;

type ProfileRow = {
  company_name: string | null;
  vat_number: string | null;
  city: string | null;
  phone: string | null;
};

function ProfileValue({ value }: { value: string | null | undefined }) {
  const has = value && value.trim().length > 0;
  return (
    <span
      className={
        has
          ? "font-mono text-[13px] text-text-primary"
          : "font-mono text-[13px] text-text-tertiary"
      }
    >
      {has ? value : "\u2014"}
    </span>
  );
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user?.id ?? "")
    .single<ProfileRow>();

  const companyName = profile?.company_name?.trim() || "Azienda";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Impostazioni"
        subtitle="Gestisci profilo, sedi, team e parametri della piattaforma."
        meta={
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
            {companyName.toUpperCase()}
          </span>
        }
      />

      <SectionFrame
        label={`Sezioni \u00B7 ${SETTINGS_SECTIONS.length}`}
        padded={false}
      >
        <nav aria-label="Sezioni impostazioni" className="px-1 pb-1">
          <ul className="flex flex-col">
            {SETTINGS_SECTIONS.map((section, i) => (
              <li key={section.href}>
                <SettingsNavRow
                  index={i + 1}
                  href={section.href}
                  label={section.label}
                  description={section.description}
                  isLast={i === SETTINGS_SECTIONS.length - 1}
                />
              </li>
            ))}
          </ul>
        </nav>
      </SectionFrame>

      <section id="profilo">
        <SectionFrame label={`Profilo \u00B7 Azienda`}>
          <dl className="grid grid-cols-[96px_1fr] sm:grid-cols-[140px_1fr] gap-x-4 gap-y-0">
            {[
              { k: "Azienda", v: profile?.company_name },
              { k: "P.IVA", v: profile?.vat_number },
              { k: "Citta", v: profile?.city },
              { k: "Telefono", v: profile?.phone },
            ].map((row, idx, arr) => (
              <div key={row.k} className="contents">
                <dt
                  className={[
                    "font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary",
                    "flex items-center py-2.5",
                    idx === arr.length - 1 ? "" : "border-b border-border-subtle",
                  ].join(" ")}
                >
                  {row.k}
                </dt>
                <dd
                  className={[
                    "flex items-center py-2.5",
                    idx === arr.length - 1 ? "" : "border-b border-border-subtle",
                  ].join(" ")}
                >
                  <ProfileValue value={row.v} />
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 flex justify-end">
            <Link
              href="/impostazioni/sedi"
              className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-text-secondary hover:text-accent-green transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-green rounded"
            >
              Modifica profilo
              <span aria-hidden>{"\u2192"}</span>
            </Link>
          </div>
        </SectionFrame>
      </section>
    </div>
  );
}
