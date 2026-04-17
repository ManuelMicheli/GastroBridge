"use client";

// Task 9 (Plan 1D) — Libro DDT client: tabella con filtri e azioni.
//
// Filtri (navigazione via URL searchParams — SSR resta sorgente di verità):
//   - ricerca testuale (numero o cliente)
//   - anno
//   - causale
//   - intervallo date (issued_at)
//
// Azioni per riga:
//   - Apri (link a /supplier/ddt/[id])
//   - Download (signed URL 5 min via getDdtSignedUrl)
//   - Ristampa COPIA (generateCopyDdt)
//   - Annulla (solo admin, modal con motivo)

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import {
  FileText,
  Download,
  Copy,
  Ban,
  ExternalLink,
  Search,
} from "lucide-react";
import {
  getDdtSignedUrl,
  generateCopyDdt,
  cancelDdt,
} from "@/lib/supplier/ddt/actions";
import type { DdtCausale } from "@/types/database";

export type DdtBookRow = {
  id: string;
  number: number;
  year: number;
  causale: DdtCausale;
  issued_at: string;
  recipient_name: string;
  canceled_at: string | null;
  delivery_id: string;
};

const CAUSALE_LABEL: Record<DdtCausale, string> = {
  sale: "Vendita",
  consignment: "Conto visione",
  return: "Reso",
  transfer: "Trasferimento",
  sample: "Campione",
  cancel: "Storno",
};

const CAUSALE_VARIANT: Record<DdtCausale, BadgeVariant> = {
  sale: "success",
  consignment: "info",
  return: "warning",
  transfer: "info",
  sample: "info",
  cancel: "warning",
};

type Filters = {
  q: string;
  year: number;
  causale: DdtCausale | null;
  from: string;
  to: string;
};

type Props = {
  initialRows: DdtBookRow[];
  years: number[];
  filters: Filters;
  canAdmin: boolean;
};

export function DdtBookClient({
  initialRows,
  years,
  filters,
  canAdmin,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [cancelTarget, setCancelTarget] = useState<DdtBookRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  function applyFilters(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    const q = String(form.get("q") ?? "").trim();
    const year = String(form.get("year") ?? "").trim();
    const causale = String(form.get("causale") ?? "").trim();
    const from = String(form.get("from") ?? "").trim();
    const to = String(form.get("to") ?? "").trim();
    if (q) params.set("q", q);
    if (year) params.set("year", year);
    if (causale) params.set("causale", causale);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    router.push(qs ? `/supplier/ddt?${qs}` : "/supplier/ddt");
  }

  function resetFilters() {
    router.push("/supplier/ddt");
  }

  const onDownload = (row: DdtBookRow) => {
    startTransition(async () => {
      const res = await getDdtSignedUrl(row.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      window.open(res.pdfUrl, "_blank", "noopener,noreferrer");
    });
  };

  const onReprintCopy = (row: DdtBookRow) => {
    startTransition(async () => {
      const res = await generateCopyDdt(row.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Copia generata");
      window.open(res.pdfUrl, "_blank", "noopener,noreferrer");
    });
  };

  const confirmCancel = () => {
    if (!cancelTarget) return;
    const reason = cancelReason.trim();
    if (reason.length < 3) {
      toast.error("Motivo obbligatorio (min. 3 caratteri)");
      return;
    }
    startTransition(async () => {
      const res = await cancelDdt(cancelTarget.id, reason);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `DDT annullato. Storno n. ${res.cancelNumber}/${res.cancelYear}`,
      );
      setCancelTarget(null);
      setCancelReason("");
      router.refresh();
    });
  };

  const hasActiveFilters =
    !!filters.q ||
    !!filters.causale ||
    !!filters.from ||
    !!filters.to ||
    searchParams.has("year");

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <form
          onSubmit={applyFilters}
          className="cq-section grid grid-cols-1 @[520px]:grid-cols-2 @[900px]:grid-cols-6 gap-3"
        >
          <label className="@[900px]:col-span-2 text-xs text-sage">
            <span className="flex items-center gap-1">
              <Search className="h-3.5 w-3.5" /> Cerca numero o cliente
            </span>
            <Input
              name="q"
              defaultValue={filters.q}
              placeholder="Es. 42 oppure Mario Rossi"
              className="mt-1"
            />
          </label>
          <label className="text-xs text-sage">
            Anno
            <select
              name="year"
              defaultValue={String(filters.year)}
              className="mt-1 w-full rounded-md border border-sage-muted bg-white px-3 py-2 text-sm text-charcoal"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-sage">
            Causale
            <select
              name="causale"
              defaultValue={filters.causale ?? ""}
              className="mt-1 w-full rounded-md border border-sage-muted bg-white px-3 py-2 text-sm text-charcoal"
            >
              <option value="">Tutte</option>
              {(Object.keys(CAUSALE_LABEL) as DdtCausale[]).map((c) => (
                <option key={c} value={c}>
                  {CAUSALE_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-sage">
            Dal
            <Input
              name="from"
              type="date"
              defaultValue={filters.from}
              className="mt-1"
            />
          </label>
          <label className="text-xs text-sage">
            Al
            <Input
              name="to"
              type="date"
              defaultValue={filters.to}
              className="mt-1"
            />
          </label>
          <div className="md:col-span-6 flex items-center gap-2">
            <Button type="submit" size="sm" variant="primary">
              Applica filtri
            </Button>
            {hasActiveFilters && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={resetFilters}
              >
                Reset
              </Button>
            )}
            <span className="ml-auto text-xs text-sage">
              {initialRows.length} risultati
            </span>
          </div>
        </form>
      </Card>

      {initialRows.length === 0 ? (
        <Card className="py-16 text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 text-sage-muted" />
          <p className="text-sage">Nessun DDT trovato.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-sage-muted/20 text-left text-xs uppercase tracking-wider text-sage">
                <tr>
                  <th className="px-4 py-3">Numero</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Causale</th>
                  <th className="px-4 py-3">Destinatario</th>
                  <th className="px-4 py-3">Stato</th>
                  <th className="px-4 py-3 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage-muted/30">
                {initialRows.map((row) => {
                  const canceled = !!row.canceled_at;
                  return (
                    <tr
                      key={row.id}
                      className={canceled ? "bg-terracotta-light/20" : ""}
                    >
                      <td className="px-4 py-3 font-semibold text-charcoal">
                        {row.number}/{row.year}
                      </td>
                      <td className="px-4 py-3 text-charcoal">
                        {new Date(row.issued_at).toLocaleDateString("it-IT")}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={CAUSALE_VARIANT[row.causale]}>
                          {CAUSALE_LABEL[row.causale]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-charcoal">
                        {row.recipient_name}
                      </td>
                      <td className="px-4 py-3">
                        {canceled ? (
                          <Badge variant="warning">Annullato</Badge>
                        ) : (
                          <Badge variant="outline">Valido</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Link
                            href={`/supplier/ddt/${row.id}`}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-forest hover:bg-forest-light/40"
                            title="Apri dettaglio"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Apri
                          </Link>
                          <button
                            type="button"
                            onClick={() => onDownload(row)}
                            disabled={pending}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-sage hover:text-forest disabled:opacity-40"
                            title="Scarica PDF"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onReprintCopy(row)}
                            disabled={pending || canceled}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-sage hover:text-forest disabled:opacity-40"
                            title="Ristampa COPIA"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          {canAdmin && !canceled && row.causale !== "cancel" && (
                            <button
                              type="button"
                              onClick={() => {
                                setCancelTarget(row);
                                setCancelReason("");
                              }}
                              disabled={pending}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-sage hover:text-red-600 disabled:opacity-40"
                              title="Annulla DDT"
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        isOpen={!!cancelTarget}
        onClose={() => {
          if (!pending) {
            setCancelTarget(null);
            setCancelReason("");
          }
        }}
        title={
          cancelTarget
            ? `Annulla DDT n. ${cancelTarget.number}/${cancelTarget.year}`
            : "Annulla DDT"
        }
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-sage">
            L&apos;annullamento è irreversibile: verrà emesso un DDT di storno
            con nuovo progressivo. Inserisci il motivo (obbligatorio).
          </p>
          <label className="block text-xs text-sage">
            Motivo annullamento
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-sage-muted bg-white px-3 py-2 text-sm text-charcoal"
              placeholder="Es. errore su destinatario"
              disabled={pending}
            />
          </label>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setCancelTarget(null);
                setCancelReason("");
              }}
              disabled={pending}
            >
              Annulla
            </Button>
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={confirmCancel}
              disabled={pending || cancelReason.trim().length < 3}
            >
              Conferma annullamento
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
