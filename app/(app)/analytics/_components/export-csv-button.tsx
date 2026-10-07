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
      className="f-btn f-btn-outline disabled:cursor-wait"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      Export CSV
    </button>
  );
}
