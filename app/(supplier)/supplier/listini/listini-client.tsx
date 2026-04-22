"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Copy, Trash2, Star, FileText } from "lucide-react";
import {
  deletePriceList,
  duplicatePriceList,
  updatePriceList,
} from "@/lib/supplier/pricing/actions";
import { formatDate } from "@/lib/utils/formatters";
import { LargeTitle } from "@/components/ui/large-title";
import { SectionFrame } from "@/components/dashboard/supplier/_awwwards/section-frame";
import type { Database } from "@/types/database";

type PriceListRow = Database["public"]["Tables"]["price_lists"]["Row"];

type ListinoSummary = PriceListRow & {
  items_count: number;
  customers_count: number;
};

type Props = {
  supplierId: string;
  initialLists: ListinoSummary[];
};

export function ListiniClient({ initialLists }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const onSetDefault = (l: ListinoSummary) => {
    if (l.is_default) return;
    if (
      !confirm(
        `Impostare "${l.name}" come listino predefinito? Il listino attuale perderà il flag.`,
      )
    ) {
      return;
    }
    setBusyId(l.id);
    startTransition(async () => {
      const res = await updatePriceList(l.id, { is_default: true });
      setBusyId(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Listino predefinito aggiornato");
      router.refresh();
    });
  };

  const onDuplicate = (l: ListinoSummary) => {
    const name = prompt(`Nome del nuovo listino?`, `${l.name} (copia)`);
    if (!name) return;
    setBusyId(l.id);
    startTransition(async () => {
      const res = await duplicatePriceList(l.id, name);
      setBusyId(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Listino duplicato");
      router.refresh();
      router.push(`/supplier/listini/${res.data.id}`);
    });
  };

  const onDelete = (l: ListinoSummary) => {
    if (l.is_default) {
      toast.error("Impossibile eliminare il listino predefinito");
      return;
    }
    if (
      !confirm(
        `Eliminare il listino "${l.name}"? L'operazione non è reversibile.`,
      )
    ) {
      return;
    }
    setBusyId(l.id);
    startTransition(async () => {
      const res = await deletePriceList(l.id);
      setBusyId(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Listino eliminato");
      router.refresh();
    });
  };

  const renderValidity = (l: ListinoSummary) => {
    if (!l.valid_from && !l.valid_to) return "—";
    const from = l.valid_from ? formatDate(l.valid_from) : "…";
    const to = l.valid_to ? formatDate(l.valid_to) : "…";
    return `${from} → ${to}`;
  };

  return (
    <div>
      {/* Mobile hero */}
      <div className="lg:hidden">
        <LargeTitle
          eyebrow={`${initialLists.length} listini configurati`}
          title="Listini"
          subtitle="Assegna prezzi ai clienti specifici"
          actions={
            <Link
              href="/supplier/listini/nuovo"
              className="flex h-9 items-center gap-1 rounded-lg bg-[color:var(--color-brand-primary)] px-3 text-[13px] font-semibold text-[color:var(--color-brand-on-primary)] active:opacity-90"
              aria-label="Nuovo listino"
            >
              <Plus className="h-3.5 w-3.5" /> Nuovo
            </Link>
          }
        />
      </div>

      {/* Desktop — terminal pricing console */}
      <div className="hidden lg:block">
        <div className="flex flex-col gap-6">
          <header>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
                Listini · pricing · assegnazioni per cliente
              </span>
              <span aria-hidden className="h-px flex-1 bg-border-subtle" />
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
                <span className="tabular-nums text-text-primary">
                  {initialLists.length}
                </span>{" "}
                configurati
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1
                  className="font-display"
                  style={{
                    fontSize: "var(--text-display-lg)",
                    lineHeight: "var(--text-display-lg--line-height)",
                    letterSpacing: "var(--text-display-lg--letter-spacing)",
                    fontWeight: "var(--text-display-lg--font-weight)",
                    color: "var(--color-text-primary)",
                  }}
                >
                  Listini
                </h1>
                <p className="mt-1.5 text-sm text-text-secondary">
                  Gestisci i listini assegnabili a clienti specifici. Esattamente
                  un listino è predefinito.
                </p>
              </div>
              <Link
                href="/supplier/listini/nuovo"
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent-green/40 bg-accent-green/10 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-green transition-colors hover:bg-accent-green/20"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden /> Nuovo listino
              </Link>
            </div>
          </header>

      {initialLists.length === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-surface-card px-6 py-16 text-center">
          <FileText className="mx-auto mb-3 h-7 w-7 text-text-tertiary" aria-hidden />
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
            Nessun listino configurato
          </p>
          <Link
            href="/supplier/listini/nuovo"
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-base px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-text-primary transition-colors hover:border-accent-green hover:text-accent-green"
          >
            <Plus className="h-3.5 w-3.5" /> Crea il primo listino
          </Link>
        </div>
      ) : (
        <SectionFrame
          label={`Listini · ${initialLists.length}`}
          trailing="default obbligatorio"
          padded={false}
        >
        <div className="overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-subtle text-left font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
                <th className="px-4 py-2 font-normal">Nome</th>
                <th className="px-4 py-2 font-normal">Default</th>
                <th className="px-4 py-2 font-normal">Validità</th>
                <th className="px-4 py-2 text-right font-normal">Prodotti</th>
                <th className="px-4 py-2 text-right font-normal">Clienti</th>
                <th className="px-4 py-2 font-normal">Stato</th>
                <th className="px-4 py-2 text-right font-normal">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {initialLists.map((l) => {
                const isBusy = pending && busyId === l.id;
                return (
                  <tr
                    key={l.id}
                    className="border-t border-border-subtle hover:bg-surface-hover"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/supplier/listini/${l.id}`}
                        className="font-medium text-text-primary hover:text-accent-green"
                      >
                        {l.name}
                      </Link>
                      {l.description && (
                        <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">
                          {l.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {l.is_default ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent-green/15 text-accent-green px-2 py-0.5 text-xs font-medium">
                          <Star className="h-3 w-3 fill-current" /> Predefinito
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSetDefault(l)}
                          disabled={isBusy}
                          className="text-xs text-text-secondary hover:text-accent-green disabled:opacity-50"
                        >
                          Imposta default
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {renderValidity(l)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-text-primary">
                      {l.items_count}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-text-primary">
                      {l.customers_count}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          l.is_active
                            ? "inline-flex items-center rounded-full bg-accent-green/15 text-accent-green px-2 py-0.5 text-xs font-medium"
                            : "inline-flex items-center rounded-full bg-surface-base text-text-secondary ring-1 ring-border-subtle px-2 py-0.5 text-xs font-medium"
                        }
                      >
                        {l.is_active ? "Attivo" : "Disattivato"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/supplier/listini/${l.id}`}
                          className="p-1.5 rounded-lg hover:bg-surface-base text-text-secondary hover:text-text-primary"
                          aria-label="Modifica"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => onDuplicate(l)}
                          disabled={isBusy}
                          className="p-1.5 rounded-lg hover:bg-surface-base text-text-secondary hover:text-text-primary disabled:opacity-50"
                          aria-label="Duplica"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(l)}
                          disabled={isBusy || l.is_default}
                          title={
                            l.is_default
                              ? "Non puoi eliminare il predefinito"
                              : "Elimina"
                          }
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-secondary hover:text-red-400 disabled:opacity-40"
                          aria-label="Elimina"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </SectionFrame>
      )}
        </div>
      </div>
    </div>
  );
}
