/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Shield, MapPin, Search, Plus } from "lucide-react";
import Link from "next/link";
import { RelationshipStatusBadge } from "@/components/shared/relationship-status-badge";
import type { RelationshipStatus } from "@/lib/relationships/types";

export const metadata: Metadata = { title: "Fornitori" };

type RelationshipRow = {
  id: string;
  status: RelationshipStatus;
  invited_at: string;
  supplier: {
    id: string;
    company_name: string;
    description: string | null;
    city: string | null;
    province: string | null;
    rating_avg: number | null;
    rating_count: number | null;
    is_verified: boolean | null;
    certifications: string[] | null;
    logo_url: string | null;
  } | null;
};

export default async function SuppliersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id")
    .eq("profile_id", user?.id ?? "")
    .limit(1)
    .maybeSingle<{ id: string }>();

  const relationships: RelationshipRow[] = restaurant
    ? (
        ((await (supabase as any)
          .from("restaurant_suppliers")
          .select(
            `id, status, invited_at,
             supplier:suppliers!supplier_id (
               id, company_name, description, city, province,
               rating_avg, rating_count, is_verified, certifications, logo_url
             )`,
          )
          .eq("restaurant_id", restaurant.id)
          .in("status", ["active", "pending", "paused"])
          .order("invited_at", { ascending: false })) as {
          data: RelationshipRow[] | null;
        }).data ?? []
      )
    : [];

  const visible = relationships.filter((r) => r.supplier !== null);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-charcoal">I tuoi fornitori</h1>
        <Link href="/fornitori/cerca">
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-forest text-white px-4 py-2 text-sm font-semibold hover:bg-forest-dark">
            <Plus className="h-4 w-4" /> Aggiungi fornitore
          </span>
        </Link>
      </div>

      {!restaurant ? (
        <Card className="text-center py-16">
          <p className="text-sage">Nessun ristorante collegato al profilo.</p>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="text-center py-16">
          <Search className="h-12 w-12 text-sage-muted mx-auto mb-4" />
          <p className="text-sage mb-4">Nessun fornitore collegato. Trova e invita i fornitori con cui vuoi lavorare.</p>
          <Link href="/fornitori/cerca">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-forest text-white px-4 py-2 text-sm font-semibold hover:bg-forest-dark">
              <Search className="h-4 w-4" /> Cerca fornitori
            </span>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((rel) => {
            const s = rel.supplier!;
            return (
              <Link key={rel.id} href={`/fornitori/${s.id}`}>
                <Card className="hover:shadow-elevated transition-shadow h-full">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-sage-muted/30 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                      {s.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.logo_url} alt={s.company_name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl font-bold text-sage">{s.company_name.charAt(0)}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <h3 className="font-bold text-charcoal truncate">{s.company_name}</h3>
                        {s.is_verified && <Shield className="h-4 w-4 text-forest shrink-0" />}
                        <RelationshipStatusBadge status={rel.status} />
                      </div>
                      {s.city && (
                        <div className="flex items-center gap-1 text-sm text-sage mb-2">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>
                            {s.city}
                            {s.province ? ` (${s.province})` : ""}
                          </span>
                        </div>
                      )}
                      {s.description && <p className="text-sm text-sage line-clamp-2 mb-3">{s.description}</p>}
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-terracotta text-terracotta" />
                          <span className="text-sm font-semibold">{(s.rating_avg ?? 0).toFixed(1)}</span>
                          <span className="text-xs text-sage">({s.rating_count ?? 0})</span>
                        </div>
                        {s.certifications?.slice(0, 2).map((cert: string) => (
                          <Badge key={cert} variant="success" className="text-[10px]">
                            {cert}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
