import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Upload } from "lucide-react";
import {
  listProductsForSupplier,
  getSupplierCatalogSummary,
  type ProductListFilters,
  type ProductListSort,
} from "@/lib/supplier/catalog/queries";
import { CatalogTable } from "@/components/supplier/catalog/catalog-table";

export const metadata: Metadata = { title: "Catalogo" };

type SearchParams = Promise<{
  cursor?: string;
  q?: string;
  category_id?: string;
  availability?: string;
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
  return "created_desc";
}

function parseAvailability(
  raw: string | undefined,
): boolean | undefined {
  if (raw === "active") return true;
  if (raw === "inactive") return false;
  return undefined;
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("profile_id", user?.id ?? "")
    .single<{ id: string }>();

  const supplierId = supplier?.id ?? null;

  if (!supplierId) {
    return (
      <Card className="text-center py-16">
        <p className="text-sage">Profilo fornitore non trovato.</p>
      </Card>
    );
  }

  const sort = parseSort(sp.sort);
  const filters: ProductListFilters = {
    q: sp.q || undefined,
    category_id: sp.category_id || undefined,
    is_available: parseAvailability(sp.availability),
  };

  const [{ items, nextCursor }, summary] = await Promise.all([
    listProductsForSupplier({
      supplierId,
      cursor: sp.cursor,
      pageSize: 50,
      search: sp.q,
      filters,
      sort,
    }),
    getSupplierCatalogSummary(supplierId),
  ]);

  // Categories for filter dropdown — small lookup, cache-friendly.
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .order("name", { ascending: true })
    .returns<Array<{ id: string; name: string }>>();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Catalogo</h1>
          <p className="text-sm text-sage mt-1">
            {summary.total.toLocaleString("it-IT")} prodotti ·{" "}
            {summary.available.toLocaleString("it-IT")} disponibili ·{" "}
            {summary.categories} categorie
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/supplier/catalogo/import">
            <Button variant="secondary" size="sm">
              <Upload className="h-4 w-4" /> Import CSV
            </Button>
          </Link>
          <Link href="/supplier/catalogo/nuovo">
            <Button size="sm">
              <Plus className="h-4 w-4" /> Nuovo Prodotto
            </Button>
          </Link>
        </div>
      </div>

      <CatalogTable
        supplierId={supplierId}
        initialItems={items}
        initialNextCursor={nextCursor}
        categories={categories ?? []}
        sort={sort}
        filters={filters}
      />
    </div>
  );
}
