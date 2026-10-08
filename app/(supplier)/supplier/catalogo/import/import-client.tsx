"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Settings2 } from "lucide-react";
import { ProductImportWizard, type CategoryOption } from "@/components/supplier/catalog/product-import-wizard";
import { SupplierSmartImport } from "@/components/import/supplier-smart-import";
import { PageHeader } from "@/components/ui/page-header";

type Props = { categories: CategoryOption[] };

export function ImportClient({ categories }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="px-1 pt-3 lg:px-0 lg:pt-0">
      <Link href="/supplier/catalogo" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-[var(--f-muted)] hover:text-[var(--f-ink)]">
        <ArrowLeft className="h-4 w-4" /> Torna al catalogo
      </Link>
      <PageHeader
        title="Importa listino"
        subtitle="Carica il tuo listino così com'è: aggiorniamo prezzi e disponibilità dei prodotti che hai già e ti proponiamo i nuovi."
      />

      <SupplierSmartImport
        advanced={
          <details className="text-[13px] text-[var(--f-muted)]">
            <summary className="inline-flex cursor-pointer items-center gap-1.5 hover:text-[var(--f-ink)]">
              <Settings2 className="h-4 w-4" /> Avanzato
            </summary>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span>Preferisci scegliere tu le colonne di un CSV/Excel?</span>
              <button type="button" className="f-btn f-btn-outline f-btn-sm" onClick={() => setOpen(true)} disabled={categories.length === 0}>
                Import con mappatura colonne
              </button>
              <a href="/template-prodotti.csv" download className="inline-flex items-center gap-1 text-[var(--acc-700)] hover:underline">
                <Download className="h-4 w-4" /> Template CSV
              </a>
            </div>
          </details>
        }
      />

      <ProductImportWizard
        open={open}
        onClose={() => setOpen(false)}
        categories={categories}
        onImported={() => router.push("/supplier/catalogo")}
      />
    </div>
  );
}
