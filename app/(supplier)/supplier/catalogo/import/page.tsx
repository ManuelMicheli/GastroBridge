"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ImportCSVPage() {
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
          Carica un file CSV con i tuoi prodotti. Colonne richieste: nome, prezzo, unita, categoria.
        </p>
        <label className="cursor-pointer">
          <input type="file" accept=".csv" className="hidden" />
          <Button>
            <Upload className="h-4 w-4" /> Seleziona File CSV
          </Button>
        </label>
        <p className="text-xs text-sage mt-4">Formato supportato: .csv (max 10MB)</p>
      </Card>
    </div>
  );
}
