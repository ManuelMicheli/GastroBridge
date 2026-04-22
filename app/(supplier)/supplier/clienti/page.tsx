import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Inbox, MapPin, Users, Utensils } from "lucide-react";
import { getClientsForSupplier } from "@/lib/relationships/queries";
import { formatDate } from "@/lib/utils/formatters";
import { RelationshipStatusBadge } from "@/components/shared/relationship-status-badge";
import { RelationshipStatusBadge as RelationshipStatusBadgeUI } from "@/components/ui/relationship-status-badge";
import { ClientActions } from "./client-actions";
import { LargeTitle } from "@/components/ui/large-title";
import { GroupedList, GroupedListRow } from "@/components/ui/grouped-list";
import { SectionFrame } from "@/components/dashboard/supplier/_awwwards/section-frame";

export const metadata: Metadata = { title: "Clienti" };

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default async function ClientsPage() {
  const relationships = await getClientsForSupplier({
    status: ["pending", "active", "paused"],
  });

  const visible = relationships.filter((r) => r.restaurant !== null);
  const pending = visible.filter((r) => r.status === "pending");
  const ongoing = visible.filter((r) => r.status !== "pending");
  const cities = new Set(
    visible.map((r) => r.restaurant?.city ?? "").filter(Boolean),
  ).size;

  return (
    <>
      {/* Mobile Apple-app view — untouched */}
      <div className="lg:hidden pb-4">
        <LargeTitle
          eyebrow={
            pending.length > 0
              ? `${pending.length} richieste nuove`
              : "Relazioni attive"
          }
          title={`${visible.length} clienti`}
        />

        {pending.length > 0 && (
          <GroupedList className="mt-3" label={`Richieste · ${pending.length}`}>
            {pending.map((rel) => {
              const r = rel.restaurant!;
              return (
                <GroupedListRow
                  key={`m-p-${rel.id}`}
                  href={`/supplier/clienti/${rel.id}`}
                  leading={
                    <div
                      className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[#7A5B18] font-serif text-[10px] font-medium text-white"
                      style={{ fontFamily: "Georgia, serif" }}
                      aria-hidden
                    >
                      {initials(r.name)}
                    </div>
                  }
                  title={r.name}
                  subtitle={
                    <span>
                      {r.city ?? "—"} · inviato {formatDate(rel.invited_at)}
                    </span>
                  }
                  trailing={
                    <RelationshipStatusBadgeUI
                      status={rel.status}
                      size="xs"
                    />
                  }
                />
              );
            })}
          </GroupedList>
        )}

        {ongoing.length > 0 && (
          <GroupedList className="mt-3" label={`Attivi · ${ongoing.length}`}>
            {ongoing.map((rel) => {
              const r = rel.restaurant!;
              return (
                <GroupedListRow
                  key={`m-o-${rel.id}`}
                  href={`/supplier/clienti/${rel.id}`}
                  leading={
                    <div
                      className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[color:var(--color-brand-primary)] font-serif text-[10px] font-medium text-[color:var(--color-brand-on-primary)]"
                      style={{ fontFamily: "Georgia, serif" }}
                      aria-hidden
                    >
                      {initials(r.name)}
                    </div>
                  }
                  title={r.name}
                  subtitle={<span>{r.city ?? "—"}</span>}
                  trailing={
                    <RelationshipStatusBadgeUI
                      status={rel.status}
                      size="xs"
                    />
                  }
                />
              );
            })}
          </GroupedList>
        )}

        {visible.length === 0 && (
          <div className="mt-6 px-6 text-center text-[color:var(--text-muted-light)]">
            Nessun cliente ancora.
          </div>
        )}
      </div>

      {/* Desktop — terminal relationship console */}
      <div className="hidden lg:block">
        <div className="flex flex-col gap-6">
          {/* Terminal header */}
          <header>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
                Clienti · relazioni · richieste in sospeso
              </span>
              <span aria-hidden className="h-px flex-1 bg-border-subtle" />
              <span className="inline-flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
                <span className="tabular-nums text-text-primary">
                  {visible.length}
                </span>
                <span>totali</span>
                <span aria-hidden>·</span>
                <span className="tabular-nums text-accent-amber">
                  {pending.length}
                </span>
                <span>in attesa</span>
                <span aria-hidden>·</span>
                <span className="tabular-nums text-accent-green">
                  {ongoing.length}
                </span>
                <span>attivi</span>
                <span aria-hidden>·</span>
                <span className="tabular-nums text-text-primary">{cities}</span>
                <span>città</span>
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
              Clienti
            </h1>
            <p className="mt-1.5 text-sm text-text-secondary">
              Gestisci le relazioni con i ristoratori: accetta richieste, metti
              in pausa, riattiva. Ogni cliente è una partnership attiva.
            </p>
          </header>

          {/* Pending requests */}
          <SectionFrame
            label={`Richieste in attesa · ${pending.length}`}
            trailing={
              pending.length > 0 ? (
                <span className="text-accent-amber">azione richiesta</span>
              ) : undefined
            }
            padded={false}
          >
            {pending.length === 0 ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8 font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
                <Inbox className="h-3.5 w-3.5" aria-hidden />
                Nessuna nuova richiesta
              </div>
            ) : (
              <div
                className="grid gap-3 p-4"
                style={{
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
                }}
              >
                {pending.map((rel) => {
                  const r = rel.restaurant!;
                  return (
                    <article
                      key={rel.id}
                      className="group flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface-card p-4 transition-colors hover:border-accent-amber/50"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-accent-amber/30 bg-accent-amber/10 font-mono text-[11px] uppercase tracking-[0.06em] text-accent-amber"
                          aria-hidden
                        >
                          {initials(r.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/supplier/clienti/${rel.id}`}
                              className="truncate text-[14px] text-text-primary hover:text-accent-green"
                            >
                              {r.name}
                            </Link>
                            <RelationshipStatusBadge status={rel.status} />
                          </div>
                          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-text-tertiary">
                            Ricevuta il {formatDate(rel.invited_at)}
                          </p>
                        </div>
                      </div>
                      {(r.city || r.cuisine) && (
                        <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.06em] text-text-tertiary">
                          {r.city && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" aria-hidden />
                              {r.city}
                            </span>
                          )}
                          {r.cuisine && (
                            <span className="inline-flex items-center gap-1 capitalize">
                              <Utensils className="h-3 w-3" aria-hidden />
                              {r.cuisine}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="pt-1">
                        <ClientActions
                          relationshipId={rel.id}
                          status={rel.status}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </SectionFrame>

          {/* Ongoing clients */}
          <SectionFrame
            label={`Clienti collegati · ${ongoing.length}`}
            trailing={
              <Link
                href="/supplier/invito"
                className="text-accent-green hover:text-text-primary transition-colors"
              >
                invita nuovo →
              </Link>
            }
            padded={false}
          >
            {ongoing.length === 0 ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8 font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
                <Users className="h-3.5 w-3.5" aria-hidden />
                Nessun cliente attivo — accetta una richiesta per iniziare una
                partnership
              </div>
            ) : (
              <ul className="flex flex-col">
                {ongoing.map((rel) => {
                  const r = rel.restaurant!;
                  return (
                    <li key={rel.id}>
                      <Link
                        href={`/supplier/clienti/${rel.id}`}
                        className="group grid w-full grid-cols-[40px_minmax(0,1.4fr)_minmax(0,1fr)_auto_12px] items-center gap-x-3 border-l-2 border-transparent px-3 text-left transition-colors hover:border-accent-green hover:bg-surface-hover"
                        style={{ minHeight: 52 }}
                      >
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-surface-base font-mono text-[10px] uppercase tracking-[0.06em] text-text-secondary"
                          aria-hidden
                        >
                          {initials(r.name)}
                        </div>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-[13px] text-text-primary">
                            {r.name}
                          </span>
                          <span className="truncate font-mono text-[10px] uppercase tracking-[0.06em] text-text-tertiary">
                            {r.city ?? "—"}
                            {r.cuisine ? ` · ${r.cuisine}` : ""}
                          </span>
                        </span>
                        <span className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.06em] text-text-tertiary">
                          {r.city && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" aria-hidden />
                              {r.city}
                            </span>
                          )}
                          {r.cuisine && (
                            <span className="inline-flex items-center gap-1 capitalize">
                              <Utensils className="h-3 w-3" aria-hidden />
                              {r.cuisine}
                            </span>
                          )}
                        </span>
                        <RelationshipStatusBadge status={rel.status} />
                        <ArrowRight
                          className="h-3 w-3 text-text-tertiary transition-colors group-hover:text-accent-green"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionFrame>
        </div>
      </div>
    </>
  );
}
