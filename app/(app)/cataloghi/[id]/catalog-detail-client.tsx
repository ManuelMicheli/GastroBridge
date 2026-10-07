"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2, Plus, Search, Upload } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Avatar } from "@/components/fernly/primitives";
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
  const { confirm, dialog } = useConfirm();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initialItems;
    return initialItems.filter((i) => i.product_name.toLowerCase().includes(q));
  }, [initialItems, query]);

  const avgPrice =
    initialItems.length === 0 ? 0 : initialItems.reduce((s, i) => s + i.price, 0) / initialItems.length;

  const onDelete = async (itemId: string) => {
    if (!(await confirm({ title: "Eliminare questo prodotto?", confirmLabel: "Elimina", tone: "danger" }))) return;
    startTransition(async () => {
      const res = await deleteCatalogItem(itemId, catalog.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Prodotto eliminato");
      router.refresh();
    });
  };

  const onDeleteCatalog = async () => {
    if (
      !(await confirm({
        title: `Eliminare il catalogo “${catalog.supplier_name}”?`,
        description: "Verranno eliminati anche tutti i suoi prodotti. L'azione è irreversibile.",
        confirmLabel: "Elimina catalogo",
        tone: "danger",
      }))
    )
      return;
    startTransition(async () => {
      const res = await deleteCatalog(catalog.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Catalogo eliminato");
      router.push("/cataloghi");
    });
  };

  return (
    <div className="space-y-5 px-1 pt-3 lg:px-0 lg:pt-0">
      <div>
        <Link href="/cataloghi" className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--f-muted)] hover:text-[var(--f-ink)]">
          <ArrowLeft className="h-4 w-4" /> Cataloghi
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={catalog.supplier_name} size={56} />
          <div className="min-w-0">
            <h1 className="f-title f-type truncate">{catalog.supplier_name}</h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-[var(--f-muted)]">
              <span className="tabular-nums">{initialItems.length} prodotti</span>
              <span className="tabular-nums">Prezzo medio € {avgPrice.toFixed(2)}</span>
            </div>
            {catalog.notes && <p className="mt-1.5 text-[13px] text-[var(--f-ink-2)]">{catalog.notes}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setItemDialog({ open: true, item: null })} className="f-btn f-btn-primary">
            <Plus className="h-4 w-4" /> Aggiungi prodotto
          </button>
          <button onClick={() => setImportOpen(true)} className="f-btn f-btn-outline">
            <Upload className="h-4 w-4" /> Importa da file
          </button>
          <button onClick={() => setEditCatalog(true)} className="f-icon-btn" aria-label="Modifica catalogo" title="Modifica">
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={onDeleteCatalog}
            disabled={pending}
            className="f-icon-btn !text-[var(--f-danger)] hover:!bg-[var(--f-danger-bg)]"
            aria-label="Elimina catalogo"
            title="Elimina catalogo"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      <label className="relative flex h-10 w-full max-w-sm items-center">
        <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-[var(--f-muted)]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca prodotto..."
          aria-label="Cerca prodotto"
          className="h-10 w-full rounded-full border border-[var(--f-line)] bg-[var(--f-card)] pl-10 pr-4 text-[13.5px] text-[var(--f-ink)] outline-none placeholder:text-[var(--f-faint)] focus:border-[color:color-mix(in_oklab,var(--acc-600)_50%,transparent)] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--acc-600)_14%,transparent)]"
        />
      </label>

      <div className="f-card f-rise overflow-x-auto">
        <table className="min-w-full text-[13.5px]">
          <thead className="text-[12px] text-[var(--f-muted)]">
            <tr>
              <th className="px-5 pb-2 pt-4 text-left font-medium">Nome</th>
              <th className="px-3 pb-2 pt-4 text-left font-medium">Unità</th>
              <th className="px-3 pb-2 pt-4 text-right font-medium">Prezzo</th>
              <th className="px-3 pb-2 pt-4 text-left font-medium">Note</th>
              <th className="px-5 pb-2 pt-4" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-[var(--f-muted)]">Nessun prodotto</td></tr>
            ) : filtered.map((i) => (
              <tr key={i.id} className="border-t border-[var(--f-line)] transition-colors hover:bg-[var(--f-fill)]">
                <td className="px-5 py-2.5 font-medium text-[var(--f-ink)]">{i.product_name}</td>
                <td className="px-3 py-2.5 text-[var(--f-ink-2)]">{i.unit}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[var(--f-ink)]">€ {i.price.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-[var(--f-muted)]">{i.notes}</td>
                <td className="whitespace-nowrap px-5 py-2.5 text-right">
                  <button
                    onClick={() => setItemDialog({ open: true, item: { id: i.id, product_name: i.product_name, unit: i.unit, price: i.price, notes: i.notes } })}
                    className="rounded-full p-1.5 text-[var(--f-muted)] hover:bg-[var(--f-fill-2)] hover:text-[var(--f-ink)]" title="Modifica" aria-label={`Modifica ${i.product_name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => void onDelete(i.id)}
                    className="rounded-full p-1.5 text-[var(--f-danger)] hover:bg-[var(--f-danger-bg)]" title="Elimina" aria-label={`Elimina ${i.product_name}`}
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
        key={itemDialog.item?.id ?? "new"}
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
      {dialog}
    </div>
  );
}
