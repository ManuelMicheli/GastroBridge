"use client";

import { useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { exportOrdersCsv } from "@/lib/analytics/export-csv";
import { toast } from "@/components/ui/toast";
import type { PeriodKey } from "@/lib/analytics/period";

type Props = {
  period: PeriodKey;
};

export function ExportCsvButton({ period }: Props) {
  const [pending, startTransition] = useTransition();

  function handleExport() {
    startTransition(async () => {
      const res = await exportOrdersCsv(period);
      if (!res.ok) {
        toast(`Errore export: ${res.error}`);
        return;
      }
      const blob = new Blob([res.content], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = res.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast("CSV scaricato");
    });
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={pending}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-default hover:border-border-accent text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-60 disabled:cursor-wait"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Esporta CSV
    </button>
  );
}
