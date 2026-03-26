import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Shield, MapPin } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = { title: "Fornitori" };

export default async function SuppliersPage() {
  const supabase = await createClient();
  type SupplierRow = {
    id: string; company_name: string; description: string | null;
    city: string | null; province: string | null; rating_avg: number;
    rating_count: number; is_verified: boolean; certifications: string[] | null;
    logo_url: string | null;
  };
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, company_name, description, city, province, rating_avg, rating_count, is_verified, certifications, logo_url")
    .eq("is_active", true)
    .order("rating_avg", { ascending: false })
    .returns<SupplierRow[]>();

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal mb-6">Fornitori</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {(suppliers ?? []).map((s) => (
          <Link key={s.id} href={`/fornitori/${s.id}`}>
            <Card className="hover:shadow-elevated transition-shadow h-full">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-sage-muted/30 rounded-xl flex items-center justify-center shrink-0">
                  <span className="text-xl font-bold text-sage">{s.company_name.charAt(0)}</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <h3 className="font-bold text-charcoal truncate">{s.company_name}</h3>
                    {s.is_verified && <Shield className="h-4 w-4 text-forest shrink-0" />}
                  </div>
                  {s.city && (
                    <div className="flex items-center gap-1 text-sm text-sage mb-2">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{s.city}{s.province ? ` (${s.province})` : ""}</span>
                    </div>
                  )}
                  {s.description && (
                    <p className="text-sm text-sage line-clamp-2 mb-3">{s.description}</p>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-terracotta text-terracotta" />
                      <span className="text-sm font-semibold">{s.rating_avg.toFixed(1)}</span>
                      <span className="text-xs text-sage">({s.rating_count})</span>
                    </div>
                    {s.certifications?.map((cert: string) => (
                      <Badge key={cert} variant="success" className="text-[10px]">{cert}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        ))}
        {(!suppliers || suppliers.length === 0) && (
          <div className="col-span-full text-center py-16">
            <p className="text-sage">Nessun fornitore disponibile al momento.</p>
          </div>
        )}
      </div>
    </div>
  );
}
