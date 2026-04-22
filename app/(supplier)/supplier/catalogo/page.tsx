import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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
      <div className="rounded-xl border border-border-subtle bg-surface-card px-6 py-16 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
          Profilo fornitore non trovato
        </p>
      </div>
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

      {/* Desktop — terminal command surface */}
      <div className="hidden lg:block">
        <div className="flex flex-col gap-6">
          {/* Terminal header */}
          <header>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
                Catalogo · gestione prodotti · ultimi aggiornamenti
              </span>
              <span aria-hidden className="h-px flex-1 bg-border-subtle" />
              <span className="inline-flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
                <span className="tabular-nums text-text-primary">
                  {summary.total.toLocaleString("it-IT")}
                </span>
                <span>totali</span>
                <span aria-hidden>·</span>
                <span className="tabular-nums text-accent-green">
                  {summary.available.toLocaleString("it-IT")}
                </span>
                <span>attivi</span>
                <span aria-hidden>·</span>
                <span className="tabular-nums text-text-primary">
                  {summary.categories}
                </span>
                <span>categorie</span>
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1
                  className="font-display"
                  style={{
                    fontSize: "var(--text-display-lg)",
                    lineHeight: "var(--text-display-lg--line-height)",
                    letterSpacing: "var(--text-display-lg--letter-spacing)",
                    fontWeight: "var(--text-display-lg--font-weight)",
                    color: "var(--color-text-primary)",
                  }}
                >
                  Catalogo
                </h1>
                <p className="mt-1.5 text-sm text-text-secondary">
                  Gestisci i prodotti, i prezzi e la disponibilità del tuo
                  catalogo pubblicato ai ristoratori collegati.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/supplier/catalogo/import"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-card px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-text-secondary transition-colors hover:border-accent-green/50 hover:text-text-primary"
                >
                  <Upload className="h-3.5 w-3.5" aria-hidden /> Importa CSV
                </Link>
                <Link
                  href="/supplier/catalogo/nuovo"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-accent-green/40 bg-accent-green/10 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-green transition-colors hover:bg-accent-green/20"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden /> Nuovo prodotto
                </Link>
              </div>
            </div>
          </header>

          <CatalogTable
            supplierId={supplierId}
            initialItems={items}
            initialNextCursor={nextCursor}
            categories={categories ?? []}
            sort={sort}
            filters={filters}
          />
        </div>
      </div>
    </>
  );
}
