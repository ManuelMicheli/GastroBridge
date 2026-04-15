"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, BarChart3 } from "lucide-react";
import { CatalogCard } from "@/components/dashboard/restaurant/catalog-card";
import { CatalogFormDialog } from "@/components/dashboard/restaurant/catalog-form-dialog";
import type { CatalogRow } from "@/lib/catalogs/types";

type Catalog = CatalogRow & { item_count: number };

export function CatalogsClient({ initialCatalogs }: { initialCatalogs: Catalog[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const canCompare = initialCatalogs.length >= 2;

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Cataloghi fornitori</h1>
          <p className="text-sm text-text-secondary">Inserisci i listini dei tuoi fornitori e confrontali.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/cataloghi/confronta"
            aria-disabled={!canCompare}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border-subtle text-text-primary ${
              canCompare ? "hover:bg-surface-hover" : "opacity-40 pointer-events-none"
            }`}
            title={canCompare ? "" : "Servono almeno 2 cataloghi"}
          >
            <BarChart3 className="h-4 w-4" /> Confronta tutti
          </Link>
          <button
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-green text-surface-base font-medium"
          >
            <Plus className="h-4 w-4" /> Nuovo catalogo
          </button>
        </div>
      </header>

      {initialCatalogs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-subtle p-12 text-center">
          <h2 className="text-lg font-medium text-text-primary">Nessun catalogo ancora</h2>
          <p className="mt-1 text-sm text-text-secondary">Crea il primo listino per iniziare a confrontare i prezzi.</p>
          <button
            onClick={() => setDialogOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-green text-surface-base font-medium"
          >
            <Plus className="h-4 w-4" /> Nuovo catalogo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {initialCatalogs.map((c) => (
            <CatalogCard
              key={c.id}
              id={c.id}
              supplierName={c.supplier_name}
              itemCount={c.item_count}
              updatedAt={c.updated_at}
            />
          ))}
        </div>
      )}

      <CatalogFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={(c) => { if (c) router.push(`/cataloghi/${c.id}`); else router.refresh(); }}
      />
    </div>
  );
}
