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
      className="inline-flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-card px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-text-secondary transition-colors hover:border-border-accent hover:text-text-primary hover:bg-surface-hover disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      Export CSV
    </button>
  );
}
