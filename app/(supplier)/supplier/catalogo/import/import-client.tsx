"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileSpreadsheet, Upload, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProductImportWizard, type CategoryOption } from "@/components/supplier/catalog/product-import-wizard";

type Props = { categories: CategoryOption[] };

export function ImportClient({ categories }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Link href="/supplier/catalogo" className="flex items-center gap-2 text-sage hover:text-charcoal mb-4 text-sm">
        <ArrowLeft className="h-4 w-4" /> Torna al catalogo
      </Link>
      <h1 className="text-2xl font-bold text-charcoal mb-6">Import CSV</h1>

      <Card className="max-w-2xl text-center py-12">
        <FileSpreadsheet className="h-16 w-16 text-sage-muted mx-auto mb-4" />
        <h2 className="text-lg font-bold text-charcoal mb-2">Importa il tuo catalogo</h2>
        <p className="text-sage text-sm mb-6 max-w-md mx-auto">
          Carica un file CSV o Excel con i tuoi prodotti. Colonne richieste:{" "}
          <strong>nome</strong>, <strong>unità</strong>, <strong>prezzo</strong>.
          Opzionali: brand, origine, descrizione, quantità minima.
        </p>
        <div className="flex flex-col items-center gap-3">
          <Button onClick={() => setOpen(true)} disabled={categories.length === 0}>
            <Upload className="h-4 w-4" /> Seleziona File
          </Button>
          <a
            href="/template-prodotti.csv"
            download
            className="inline-flex items-center gap-1 text-sm text-forest hover:underline"
          >
            <Download className="h-4 w-4" /> Scarica template CSV
          </a>
        </div>
        <p className="text-xs text-sage mt-4">Formati: .csv .xls .xlsx · max 2MB · max 5000 righe</p>
      </Card>

      <ProductImportWizard
        open={open}
        onClose={() => setOpen(false)}
        categories={categories}
        onImported={() => router.push("/supplier/catalogo")}
      />
    </div>
  );
}
