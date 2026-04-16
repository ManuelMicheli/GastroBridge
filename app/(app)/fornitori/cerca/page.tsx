/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MapPin, Shield, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { InviteSupplierButton } from "./invite-button";
import type { RelationshipStatus } from "@/lib/relationships/types";

export const metadata: Metadata = { title: "Trova Fornitori" };

type SupplierRow = {
  id: string;
  company_name: string;
  description: string | null;
  city: string | null;
  province: string | null;
  logo_url: string | null;
  rating_avg: number;
  rating_count: number;
  is_verified: boolean;
  certifications: string[] | null;
};

type SearchParams = Promise<{ q?: string; city?: string }>;

export default async function CercaFornitoriPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q, city } = await searchParams;

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

  let query = supabase
    .from("suppliers")
    .select("id, company_name, description, city, province, logo_url, rating_avg, rating_count, is_verified, certifications")
    .eq("is_active", true)
    .order("rating_avg", { ascending: false })
    .limit(50);

  if (q && q.trim()) query = query.ilike("company_name", `%${q.trim()}%`);
  if (city && city.trim()) query = query.ilike("city", `%${city.trim()}%`);

  const { data: suppliers } = (await query.returns<SupplierRow[]>()) as {
    data: SupplierRow[] | null;
  };

  // Relazioni esistenti per questo ristoratore (per disabilitare "Invia richiesta")
  const supplierIds = (suppliers ?? []).map((s) => s.id);
  const existing = new Map<string, RelationshipStatus>();
  if (restaurant && supplierIds.length > 0) {
    const { data: rels } = (await (supabase as any)
      .from("restaurant_suppliers")
      .select("supplier_id, status")
      .eq("restaurant_id", restaurant.id)
      .in("supplier_id", supplierIds)) as {
      data: { supplier_id: string; status: RelationshipStatus }[] | null;
    };
    for (const r of rels ?? []) existing.set(r.supplier_id, r.status);
  }

  return (
    <div>
      <Link
        href="/fornitori"
        className="inline-flex items-center gap-1 text-sm text-sage hover:text-charcoal mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Torna ai tuoi fornitori
      </Link>

      <h1 className="text-2xl font-bold text-charcoal mb-2">Trova nuovi fornitori</h1>
      <p className="text-sage mb-6">
        Cerca fornitori registrati su GastroBridge e invia una richiesta di collegamento.
      </p>

      <form className="flex flex-col sm:flex-row gap-3 mb-6" method="GET">
        <Input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Nome azienda…"
          className="flex-1"
        />
        <Input
          type="search"
          name="city"
          defaultValue={city ?? ""}
          placeholder="Città"
          className="sm:w-48"
        />
        <button
          type="submit"
          className="rounded-xl bg-forest text-white px-5 py-2 text-sm font-semibold hover:bg-forest-dark"
        >
          Cerca
        </button>
      </form>

      {!restaurant ? (
        <Card className="text-center py-10">
          <p className="text-sage">Nessun ristorante collegato al profilo.</p>
        </Card>
      ) : (suppliers ?? []).length === 0 ? (
        <Card className="text-center py-10">
          <p className="text-sage">Nessun fornitore trovato. Prova a modificare i filtri.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(suppliers ?? []).map((s) => {
            const relStatus = existing.get(s.id);
            return (
              <Card key={s.id} className="h-full">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-sage-muted/30 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                    {s.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.logo_url} alt={s.company_name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-sage">
                        {s.company_name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <h3 className="font-bold text-charcoal truncate">{s.company_name}</h3>
                      {s.is_verified && (
                        <Shield className="h-4 w-4 text-forest shrink-0" aria-label="Verificato" />
                      )}
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
                    {s.description && (
                      <p className="text-xs text-sage mb-2 line-clamp-2">{s.description}</p>
                    )}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-terracotta text-terracotta" />
                        <span className="text-sm font-semibold">{s.rating_avg.toFixed(1)}</span>
                        <span className="text-xs text-sage">({s.rating_count})</span>
                      </div>
                      {s.certifications?.slice(0, 2).map((cert) => (
                        <Badge key={cert} variant="success" className="text-[10px]">
                          {cert}
                        </Badge>
                      ))}
                    </div>
                    <InviteSupplierButton supplierId={s.id} existingStatus={relStatus} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
