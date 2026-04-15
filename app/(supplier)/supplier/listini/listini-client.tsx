"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Copy, Trash2, Star, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  deletePriceList,
  duplicatePriceList,
  updatePriceList,
} from "@/lib/supplier/pricing/actions";
import { formatDate } from "@/lib/utils/formatters";
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Listini prezzi
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Gestisci i listini assegnabili a clienti specifici. Esattamente un
            listino è predefinito.
          </p>
        </div>
        <Link href="/supplier/listini/nuovo">
          <Button size="sm">
            <Plus className="h-4 w-4" /> Nuovo listino
          </Button>
        </Link>
      </div>

      {initialLists.length === 0 ? (
        <Card className="text-center py-16">
          <FileText className="h-12 w-12 text-text-secondary mx-auto mb-4" />
          <p className="text-text-secondary mb-4">
            Nessun listino configurato.
          </p>
          <Link href="/supplier/listini/nuovo">
            <Button size="sm">
              <Plus className="h-4 w-4" /> Crea il primo listino
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-base text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Default</th>
                <th className="px-4 py-3">Validità</th>
                <th className="px-4 py-3 text-right">Prodotti</th>
                <th className="px-4 py-3 text-right">Clienti</th>
                <th className="px-4 py-3">Stato</th>
                <th className="px-4 py-3 text-right">Azioni</th>
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
      )}
    </div>
  );
}
