import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { contextCan, getRestaurantContext } from "@/lib/restaurants/context";
import { PageHeader } from "@/components/ui/page-header";
import { RestaurantSmartImport } from "@/components/import/restaurant-smart-import";

export const metadata: Metadata = { title: "Aggiungi fornitore" };

/**
 * Smart "Aggiungi fornitore": drop / paste anything, review, save.
 * `?catalog=<id>` updates an existing supplier list (price diff before saving).
 */
export default async function SmartImportPage({ searchParams }: { searchParams: Promise<{ catalog?: string }> }) {
  const { catalog } = await searchParams;
  const ctx = await getRestaurantContext();
  const canManage = ctx ? contextCan(ctx, "partnership.manage") : true; // no restaurant yet → owner onboarding

  let target: { id: string; name: string } | null = null;
  if (catalog && ctx && /^[0-9a-f-]{36}$/i.test(catalog)) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("restaurant_catalogs")
      .select("id, supplier_name, restaurant_id")
      .eq("id", catalog)
      .in("restaurant_id", ctx.scopeIds)
      .maybeSingle<{ id: string; supplier_name: string; restaurant_id: string }>();
    if (data) target = { id: data.id, name: data.supplier_name };
  }

  return (
    <div className="px-1 pt-3 lg:px-0 lg:pt-0">
      <Link
        href={target ? `/cataloghi/${target.id}` : "/cataloghi"}
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-[var(--f-muted)] hover:text-[var(--f-ink)]"
      >
        <ArrowLeft className="h-4 w-4" /> {target ? target.name : "Fornitori"}
      </Link>
      <PageHeader
        title={target ? "Aggiorna listino" : "Aggiungi fornitore"}
        subtitle={
          target
            ? "Carica il nuovo listino: ti mostriamo aumenti, ribassi e novità prima di salvare."
            : "Niente tabelle da sistemare: carica quello che ti ha mandato il fornitore e al resto pensiamo noi."
        }
      />
      {canManage ? (
        <RestaurantSmartImport targetCatalogId={target?.id ?? null} targetCatalogName={target?.name ?? null} />
      ) : (
        <div className="f-card px-6 py-10 text-center text-[14px] text-[var(--f-muted)]">
          Il tuo ruolo non consente di aggiungere o modificare fornitori. Chiedi al titolare del ristorante.
        </div>
      )}
    </div>
  );
}
