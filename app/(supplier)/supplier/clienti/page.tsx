import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { MapPin, Utensils, Users, Inbox } from "lucide-react";
import { getClientsForSupplier } from "@/lib/relationships/queries";
import { formatDate } from "@/lib/utils/formatters";
import { RelationshipStatusBadge } from "@/components/shared/relationship-status-badge";
import { RelationshipStatusBadge as RelationshipStatusBadgeUI } from "@/components/ui/relationship-status-badge";
import { ClientActions } from "./client-actions";
import { LargeTitle } from "@/components/ui/large-title";
import { GroupedList, GroupedListRow } from "@/components/ui/grouped-list";

export const metadata: Metadata = { title: "Clienti" };

export default async function ClientsPage() {
  const relationships = await getClientsForSupplier({
    status: ["pending", "active", "paused"],
  });

  const visible = relationships.filter((r) => r.restaurant !== null);
  const pending = visible.filter((r) => r.status === "pending");
  const ongoing = visible.filter((r) => r.status !== "pending");

  function initials(name: string): string {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  }

  return (
    <>
      {/* Mobile Apple-app view */}
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
                      {r.city ?? "—"} · inviato{" "}
                      {formatDate(rel.invited_at)}
                    </span>
                  }
                  trailing={<RelationshipStatusBadgeUI status={rel.status} size="xs" />}
                />
              );
            })}
          </GroupedList>
        )}

        {ongoing.length > 0 && (
          <GroupedList
            className="mt-3"
            label={`Attivi · ${ongoing.length}`}
          >
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
                  trailing={<RelationshipStatusBadgeUI status={rel.status} size="xs" />}
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

      {/* Desktop view */}
      <div className="hidden lg:block">
      <h1 className="font-display text-3xl text-text-primary mb-6">
        Clienti<span className="text-brand-primary">.</span>
      </h1>

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Inbox className="h-5 w-5 text-forest" />
          <h2 className="text-lg font-semibold text-charcoal">Richieste in attesa</h2>
          <span className="text-xs text-sage">({pending.length})</span>
        </div>
        {pending.length === 0 ? (
          <Card className="text-center py-10">
            <p className="text-sage text-sm">Nessuna nuova richiesta.</p>
          </Card>
        ) : (
          <div
            className="cq-section grid gap-4"
            style={{
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
            }}
          >
            {pending.map((rel) => {
              const r = rel.restaurant!;
              return (
                <Card key={rel.id}>
                  <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/supplier/clienti/${rel.id}`}
                          className="font-bold text-charcoal hover:underline truncate"
                        >
                          {r.name}
                        </Link>
                        <RelationshipStatusBadge status={rel.status} />
                      </div>
                      <p className="text-xs text-sage mt-1">
                        Richiesta ricevuta il {formatDate(rel.invited_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-sage mb-3">
                    {r.city && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-4 w-4" /> {r.city}
                      </span>
                    )}
                    {r.cuisine && (
                      <span className="inline-flex items-center gap-1 capitalize">
                        <Utensils className="h-4 w-4" /> {r.cuisine}
                      </span>
                    )}
                  </div>
                  <ClientActions relationshipId={rel.id} status={rel.status} />
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-5 w-5 text-forest" />
          <h2 className="text-lg font-semibold text-charcoal">Clienti collegati</h2>
          <span className="text-xs text-sage">({ongoing.length})</span>
        </div>
        {ongoing.length === 0 ? (
          <Card className="text-center py-10">
            <p className="text-sage text-sm">
              Nessun cliente attivo. Accetta una richiesta per iniziare una partnership.
            </p>
          </Card>
        ) : (
          <div
            className="cq-section grid gap-4"
            style={{
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
            }}
          >
            {ongoing.map((rel) => {
              const r = rel.restaurant!;
              return (
                <Link key={rel.id} href={`/supplier/clienti/${rel.id}`}>
                  <Card className="hover:shadow-elevated transition-shadow h-full">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3 className="font-bold text-charcoal truncate">{r.name}</h3>
                      <RelationshipStatusBadge status={rel.status} />
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-sage">
                      {r.city && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-4 w-4" /> {r.city}
                        </span>
                      )}
                      {r.cuisine && (
                        <span className="inline-flex items-center gap-1 capitalize">
                          <Utensils className="h-4 w-4" /> {r.cuisine}
                        </span>
                      )}
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
      </div>
    </>
  );
}
