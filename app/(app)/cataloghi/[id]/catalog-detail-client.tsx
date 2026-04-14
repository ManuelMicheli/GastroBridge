"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2, Plus, Upload } from "lucide-react";
import { CatalogFormDialog } from "@/components/dashboard/restaurant/catalog-form-dialog";
import { CatalogItemDialog } from "@/components/dashboard/restaurant/catalog-item-dialog";
import { CatalogImportWizard } from "@/components/dashboard/restaurant/catalog-import-wizard";
import { deleteCatalog, deleteCatalogItem } from "@/lib/catalogs/actions";
import type { CatalogRow, CatalogItemRow } from "@/lib/catalogs/types";

type ItemData = { id: string; product_name: string; unit: string; price: number; notes: string | null };

export function CatalogDetailClient({
  catalog,
  initialItems,
}: {
  catalog: CatalogRow;
  initialItems: CatalogItemRow[];
}) {
  const router = useRouter();
  const [editCatalog, setEditCatalog] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [itemDialog, setItemDialog] = useState<{ open: boolean; item: ItemData | null }>({ open: false, item: null });
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initialItems;
    return initialItems.filter((i) => i.product_name.toLowerCase().includes(q));
  }, [initialItems, query]);

  const avgPrice =
    initialItems.length === 0 ? 0 : initialItems.reduce((s, i) => s + i.price, 0) / initialItems.length;

  const onDelete = (itemId: string) => {
    if (!confirm("Eliminare questo prodotto?")) return;
    startTransition(async () => {
      const res = await deleteCatalogItem(itemId, catalog.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Prodotto eliminato");
      router.refresh();
    });
  };

  const onDeleteCatalog = () => {
    if (!confirm(`Eliminare il catalogo "${catalog.supplier_name}" e tutti i suoi prodotti?`)) return;
    startTransition(async () => {
      const res = await deleteCatalog(catalog.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Catalogo eliminato");
      router.push("/cataloghi");
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link href="/cataloghi" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
          <ArrowLeft className="h-4 w-4" /> Cataloghi
        </Link>
      </div>

      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{catalog.supplier_name}</h1>
          <div className="mt-1 text-sm text-text-secondary flex flex-wrap gap-x-4 gap-y-1">
            <span>{initialItems.length} prodotti</span>
            <span>Prezzo medio € {avgPrice.toFixed(2)}</span>
            {catalog.delivery_days !== null && <span>Consegna {catalog.delivery_days} gg</span>}
            {catalog.min_order_amount !== null && <span>Min. ordine € {catalog.min_order_amount.toFixed(2)}</span>}
          </div>
          {catalog.notes && <p className="mt-2 text-sm text-text-tertiary">{catalog.notes}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditCatalog(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-subtle text-text-primary hover:bg-surface-hover">
            <Pencil className="h-4 w-4" /> Modifica
          </button>
          <button onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-subtle text-text-primary hover:bg-surface-hover">
            <Upload className="h-4 w-4" /> Importa da file
          </button>
          <button onClick={() => setItemDialog({ open: true, item: null })}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent-green text-surface-base font-medium">
            <Plus className="h-4 w-4" /> Aggiungi prodotto
          </button>
          <button onClick={onDeleteCatalog} disabled={pending}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-subtle text-red-400 hover:bg-red-500/10">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cerca prodotto..."
        className="w-full max-w-sm rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
      />

      <div className="rounded-xl border border-border-subtle overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-card text-text-tertiary">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Nome</th>
              <th className="text-left px-3 py-2 font-medium">Unità</th>
              <th className="text-right px-3 py-2 font-medium">Prezzo</th>
              <th className="text-left px-3 py-2 font-medium">Note</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-text-tertiary">Nessun prodotto</td></tr>
            ) : filtered.map((i) => (
              <tr key={i.id} className="border-t border-border-subtle hover:bg-surface-hover">
                <td className="px-3 py-2 text-text-primary">{i.product_name}</td>
                <td className="px-3 py-2 text-text-secondary">{i.unit}</td>
                <td className="px-3 py-2 text-right text-text-primary tabular-nums">€ {i.price.toFixed(2)}</td>
                <td className="px-3 py-2 text-text-tertiary">{i.notes}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => setItemDialog({ open: true, item: { id: i.id, product_name: i.product_name, unit: i.unit, price: i.price, notes: i.notes } })}
                    className="p-1.5 rounded hover:bg-surface-hover text-text-secondary" title="Modifica"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(i.id)}
                    className="p-1.5 rounded hover:bg-red-500/10 text-red-400" title="Elimina"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CatalogFormDialog
        open={editCatalog}
        onClose={() => setEditCatalog(false)}
        catalog={catalog}
        onSaved={() => router.refresh()}
      />
      <CatalogItemDialog
        open={itemDialog.open}
        onClose={() => setItemDialog({ open: false, item: null })}
        catalogId={catalog.id}
        item={itemDialog.item}
        onSaved={() => router.refresh()}
      />
      <CatalogImportWizard
        open={importOpen}
        onClose={() => setImportOpen(false)}
        catalogId={catalog.id}
        onImported={() => router.refresh()}
      />
    </div>
  );
}
