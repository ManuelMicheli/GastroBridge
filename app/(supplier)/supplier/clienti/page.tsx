import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { MapPin, Utensils, Users, Inbox } from "lucide-react";
import { getClientsForSupplier } from "@/lib/relationships/queries";
import { formatDate } from "@/lib/utils/formatters";
import { RelationshipStatusBadge } from "@/components/shared/relationship-status-badge";
import { ClientActions } from "./client-actions";

export const metadata: Metadata = { title: "Clienti" };

export default async function ClientsPage() {
  const relationships = await getClientsForSupplier({
    status: ["pending", "active", "paused"],
  });

  const visible = relationships.filter((r) => r.restaurant !== null);
  const pending = visible.filter((r) => r.status === "pending");
  const ongoing = visible.filter((r) => r.status !== "pending");

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal mb-6">I tuoi Clienti</h1>

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
  );
}
