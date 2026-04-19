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
import { LargeTitle } from "@/components/ui/large-title";
import { GroupedList, GroupedListRow } from "@/components/ui/grouped-list";
import { formatCurrency } from "@/lib/utils/formatters";

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
    <>
      {/* Mobile Apple-app view */}
      <div className="lg:hidden pb-4">
        <LargeTitle
          eyebrow={`${summary.categories} categorie · ${summary.available} disponibili`}
          title={`${summary.total.toLocaleString("it-IT")} prodotti`}
          subtitle="Gestisci il tuo catalogo"
          actions={
            <Link
              href="/supplier/catalogo/nuovo"
              className="flex h-9 items-center gap-1 rounded-lg bg-[color:var(--color-brand-primary)] px-3 text-[13px] font-semibold text-[color:var(--color-brand-on-primary)] active:opacity-90"
              aria-label="Nuovo prodotto"
            >
              <Plus className="h-3.5 w-3.5" /> Nuovo
            </Link>
          }
        />

        <GroupedList className="mt-3" label="Azioni">
          <GroupedListRow
            href="/supplier/catalogo/import"
            leading={
              <div
                className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-[#2B6F42] text-white"
                aria-hidden
              >
                <Upload className="h-3.5 w-3.5" />
              </div>
            }
            title="Importa CSV"
            subtitle="Carica prodotti in blocco"
            showChevron
          />
        </GroupedList>

        {items.length === 0 ? (
          <div className="mt-6 px-6 text-center text-[color:var(--text-muted-light)]">
            Nessun prodotto. Inizia aggiungendo il primo.
          </div>
        ) : (
          <GroupedList
            className="mt-3"
            label={`Prodotti · ${items.length}`}
            labelAction={
              nextCursor ? (
                <Link
                  href={`/supplier/catalogo?cursor=${nextCursor}`}
                  className="text-[11px] text-[color:var(--color-brand-primary)]"
                >
                  Carica altri →
                </Link>
              ) : null
            }
          >
            {items.map((p) => (
              <GroupedListRow
                key={p.id}
                href={`/supplier/catalogo/${p.id}`}
                leading={
                  p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt=""
                      className="h-[36px] w-[36px] rounded-md object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden
                      className="h-[36px] w-[36px] rounded-md bg-gradient-to-br from-[#E8DDC9] to-[#D3C4AE]"
                    />
                  )
                }
                title={p.name}
                subtitle={
                  <span>
                    {p.brand ? `${p.brand} · ` : ""}
                    {p.unit}
                    {p.is_available === false ? " · NON disponibile" : ""}
                  </span>
                }
                trailing={
                  <span
                    className="font-serif text-[14px] text-[color:var(--color-brand-primary)]"
                    style={{ fontFamily: "Georgia, serif" }}
                  >
                    {formatCurrency(Number(p.price))}
                  </span>
                }
                showChevron
              />
            ))}
          </GroupedList>
        )}
      </div>

      {/* Desktop */}
      <div className="hidden lg:block">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-text-primary">
            Catalogo<span className="text-brand-primary">.</span>
          </h1>
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
    </>
  );
}
