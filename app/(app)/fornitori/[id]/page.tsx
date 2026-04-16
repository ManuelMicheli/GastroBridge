import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/formatters";
import { Star, Shield, MapPin, Phone, Globe } from "lucide-react";
import {
  listProductsForSupplier,
  getSupplierCatalogSummary,
  type ProductListFilters,
  type ProductListSort,
} from "@/lib/supplier/catalog/queries";
import { SupplierProductsGrid } from "@/components/supplier/catalog/supplier-products-grid";

type SearchParams = Promise<{
  cursor?: string;
  q?: string;
  category_id?: string;
  sort?: string;
}>;

function parseSort(raw: string | undefined): ProductListSort {
  if (
    raw === "created_desc" ||
    raw === "name_asc" ||
    raw === "price_asc" ||
    raw === "price_desc"
  ) {
    return raw;
  }
  return "name_asc";
}

export default async function SupplierDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select(
      "id,company_name,description,city,province,phone,website,rating_avg,rating_count,is_verified,min_order_amount,certifications,logo_url,cover_url",
    )
    .eq("id", id)
    .maybeSingle<{
      id: string;
      company_name: string;
      description: string | null;
      city: string | null;
      province: string | null;
      phone: string | null;
      website: string | null;
      rating_avg: number;
      rating_count: number;
      is_verified: boolean;
      min_order_amount: number | null;
      certifications: string[] | null;
      logo_url: string | null;
      cover_url: string | null;
    }>();

  if (!supplier) notFound();

  const sort = parseSort(sp.sort);
  const filters: ProductListFilters = {
    q: sp.q || undefined,
    category_id: sp.category_id || undefined,
    is_available: true,
  };

  const [{ items, nextCursor }, summary, categoriesRes] = await Promise.all([
    listProductsForSupplier({
      supplierId: id,
      cursor: sp.cursor,
      pageSize: 48,
      search: sp.q,
      filters,
      sort,
    }),
    getSupplierCatalogSummary(id),
    supabase
      .from("categories")
      .select("id, name")
      .order("name", { ascending: true })
      .returns<Array<{ id: string; name: string }>>(),
  ]);
  const categories = categoriesRes.data ?? [];

  return (
    <div>
      {/* Supplier Header */}
      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="w-20 h-20 bg-sage-muted/30 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden">
            {supplier.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={supplier.logo_url}
                alt={supplier.company_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-3xl font-bold text-sage">
                {supplier.company_name.charAt(0)}
              </span>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold text-charcoal">
                {supplier.company_name}
              </h1>
              {supplier.is_verified && (
                <Badge variant="success">
                  <Shield className="h-3 w-3 mr-1" />
                  Verificato
                </Badge>
              )}
            </div>
            {supplier.description && (
              <p className="text-sage mb-3">{supplier.description}</p>
            )}
            <div className="flex flex-wrap gap-4 text-sm text-sage">
              {supplier.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" /> {supplier.city}
                  {supplier.province ? ` (${supplier.province})` : ""}
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
                <span className="font-bold text-lg">
                  {supplier.rating_avg.toFixed(1)}
                </span>
                <span className="text-sm text-sage">
                  ({supplier.rating_count} recensioni)
                </span>
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
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-xl font-bold text-charcoal">Catalogo</h2>
        <p className="text-sm text-sage">
          {summary.available.toLocaleString("it-IT")} prodotti disponibili
        </p>
      </div>

      <SupplierProductsGrid
        supplierId={id}
        initialItems={items}
        initialNextCursor={nextCursor}
        categories={categories}
        sort={sort}
        filters={filters}
      />
    </div>
  );
}
