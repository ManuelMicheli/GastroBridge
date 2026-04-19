import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { LargeTitle } from "@/components/ui/large-title";
import { GroupedList, GroupedListRow } from "@/components/ui/grouped-list";
import { SectionFrame } from "@/components/dashboard/restaurant/_awwwards/section-frame";
import { SettingsNavRow } from "./_components/settings-nav-row";

export const metadata: Metadata = { title: "Impostazioni" };

type SettingsIconKey =
  | "profilo"
  | "sedi"
  | "notifiche"
  | "esigenze"
  | "budget"
  | "team"
  | "abbonamento";

const SETTINGS_SECTIONS: ReadonlyArray<{
  href: string;
  label: string;
  description: string;
  icon: SettingsIconKey;
  color: string;
  group: "azienda" | "app" | "account";
}> = [
  {
    href: "#profilo",
    label: "Profilo",
    description: "Dati azienda, P.IVA, contatti",
    icon: "profilo",
    color: "#8B2A30",
    group: "azienda",
  },
  {
    href: "/impostazioni/sedi",
    label: "Sedi",
    description: "Gestisci i tuoi ristoranti",
    icon: "sedi",
    color: "#2B6F42",
    group: "azienda",
  },
  {
    href: "/impostazioni/team",
    label: "Team",
    description: "Membri del team",
    icon: "team",
    color: "#1E3A8A",
    group: "azienda",
  },
  {
    href: "/impostazioni/esigenze-fornitura",
    label: "Esigenze di fornitura",
    description: "Vincoli, priorità e profilo di acquisto",
    icon: "esigenze",
    color: "#7A5B18",
    group: "azienda",
  },
  {
    href: "/impostazioni/budget",
    label: "Budget mensile",
    description: "Tetto di spesa per tracking analytics",
    icon: "budget",
    color: "#7A5B18",
    group: "azienda",
  },
  {
    href: "/impostazioni/notifiche",
    label: "Notifiche",
    description: "Canali, push browser e avvisi in tempo reale",
    icon: "notifiche",
    color: "#8B2A30",
    group: "app",
  },
  {
    href: "/impostazioni/abbonamento",
    label: "Abbonamento",
    description: "Piano e fatturazione",
    icon: "abbonamento",
    color: "#6B5D5F",
    group: "account",
  },
];

function SettingsIcon({ icon }: { icon: SettingsIconKey }) {
  const path: Record<SettingsIconKey, string> = {
    profilo: "M8 8a3 3 0 100-6 3 3 0 000 6zm-5 6a5 5 0 0110 0",
    sedi: "M8 14s5-5 5-9a5 5 0 10-10 0c0 4 5 9 5 9zM8 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
    notifiche: "M8 2a4 4 0 014 4v3l1 2H3l1-2V6a4 4 0 014-4zM7 13a1.5 1.5 0 002 0",
    esigenze: "M3 4h10M3 8h10M3 12h7",
    budget: "M2 4h12v8H2zM8 6v4M6 8h4",
    team: "M6 8a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM12 9a2 2 0 100-4 2 2 0 000 4zM2 14a4 4 0 018 0M10 14a3 3 0 014-2",
    abbonamento: "M2 6h12M2 9h12M2 4h12v8H2z",
  };
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <path
        d={path[icon]}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

  const azienda = SETTINGS_SECTIONS.filter((s) => s.group === "azienda");
  const app = SETTINGS_SECTIONS.filter((s) => s.group === "app");
  const account = SETTINGS_SECTIONS.filter((s) => s.group === "account");

  return (
    <>
      {/* Mobile Apple-app view */}
      <div className="lg:hidden pb-4">
        <div className="flex items-center gap-3 px-4 pt-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--color-brand-primary)] font-serif text-[16px] font-medium text-[color:var(--color-brand-on-primary)]"
            style={{ fontFamily: "Georgia, serif" }}
            aria-hidden
          >
            {companyName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="truncate font-serif text-[18px] font-medium tracking-[-0.015em] text-[color:var(--color-text-primary)] dark:text-white"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {companyName}
            </div>
            <div className="text-[11px] text-[color:var(--text-muted-light)]">
              {profile?.vat_number ? `P.IVA ${profile.vat_number}` : "Admin"}
            </div>
          </div>
          <span
            aria-hidden
            className="text-[color:var(--ios-chev-muted)]"
          >
            ›
          </span>
        </div>

        <GroupedList className="mt-4" label="Azienda">
          {azienda.map((s) => (
            <GroupedListRow
              key={s.href}
              href={s.href}
              leading={
                <div
                  className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-white"
                  style={{ background: s.color }}
                >
                  <SettingsIcon icon={s.icon} />
                </div>
              }
              title={s.label}
              subtitle={s.description}
              showChevron
            />
          ))}
        </GroupedList>

        <GroupedList className="mt-2" label="App">
          {app.map((s) => (
            <GroupedListRow
              key={s.href}
              href={s.href}
              leading={
                <div
                  className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-white"
                  style={{ background: s.color }}
                >
                  <SettingsIcon icon={s.icon} />
                </div>
              }
              title={s.label}
              subtitle={s.description}
              showChevron
            />
          ))}
        </GroupedList>

        {account.length > 0 && (
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
                    <SettingsIcon icon={s.icon} />
                  </div>
                }
                title={s.label}
                subtitle={s.description}
                showChevron
              />
            ))}
          </GroupedList>
        )}

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
      <div className="hidden lg:block space-y-6">
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
    </>
  );
}
