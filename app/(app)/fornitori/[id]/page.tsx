import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatUnitShort } from "@/lib/utils/formatters";
import { Star, Shield, MapPin, Phone, Globe } from "lucide-react";
import type { UnitType } from "@/types/database";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", id)
    .single<{
      id: string; company_name: string; description: string | null;
      city: string | null; province: string | null; phone: string | null;
      website: string | null; rating_avg: number; rating_count: number;
      is_verified: boolean; min_order_amount: number | null;
      certifications: string[] | null;
    }>();

  if (!supplier) notFound();

  const { data: products } = await supabase
    .from("products")
    .select("id, name, brand, unit, price, image_url, certifications, is_featured")
    .eq("supplier_id", id)
    .eq("is_available", true)
    .order("is_featured", { ascending: false })
    .order("name")
    .returns<Array<{
      id: string; name: string; brand: string | null; unit: string;
      price: number; image_url: string | null; certifications: string[] | null;
      is_featured: boolean;
    }>>();

  return (
    <div>
      {/* Supplier Header */}
      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="w-20 h-20 bg-sage-muted/30 rounded-2xl flex items-center justify-center shrink-0">
            <span className="text-3xl font-bold text-sage">{supplier.company_name.charAt(0)}</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold text-charcoal">{supplier.company_name}</h1>
              {supplier.is_verified && (
                <Badge variant="success"><Shield className="h-3 w-3 mr-1" />Verificato</Badge>
              )}
            </div>
            {supplier.description && (
              <p className="text-sage mb-3">{supplier.description}</p>
            )}
            <div className="flex flex-wrap gap-4 text-sm text-sage">
              {supplier.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" /> {supplier.city} ({supplier.province})
                </span>
              )}
              {supplier.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-4 w-4" /> {supplier.phone}
                </span>
              )}
              {supplier.website && (
                <span className="flex items-center gap-1">
                  <Globe className="h-4 w-4" /> {supplier.website}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1">
                <Star className="h-5 w-5 fill-terracotta text-terracotta" />
                <span className="font-bold text-lg">{supplier.rating_avg.toFixed(1)}</span>
                <span className="text-sm text-sage">({supplier.rating_count} recensioni)</span>
              </div>
              {supplier.min_order_amount && (
                <span className="text-sm text-sage">
                  Ordine min: {formatCurrency(supplier.min_order_amount)}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Products */}
      <h2 className="text-xl font-bold text-charcoal mb-4">
        Catalogo ({products?.length ?? 0} prodotti)
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(products ?? []).map((p) => (
          <Card key={p.id} className="hover:shadow-elevated transition-shadow">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <h3 className="font-semibold text-charcoal truncate">{p.name}</h3>
                {p.brand && <p className="text-xs text-sage">{p.brand}</p>}
              </div>
              {p.is_featured && <Badge variant="warning">In evidenza</Badge>}
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-xl font-mono font-bold text-forest">
                {formatCurrency(p.price)}
              </span>
              <span className="text-sm text-sage">/{formatUnitShort(p.unit as UnitType)}</span>
            </div>
            {p.certifications && p.certifications.length > 0 && (
              <div className="flex gap-1 mt-2">
                {p.certifications.map((cert: string) => (
                  <Badge key={cert} variant="success" className="text-[10px]">{cert}</Badge>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
