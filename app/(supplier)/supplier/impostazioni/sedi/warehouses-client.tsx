"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  MapPin,
  Pencil,
  Archive,
  Star,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { WarehouseFormDialog } from "@/components/supplier/warehouses/warehouse-form";
import {
  archiveWarehouse,
  setPrimaryWarehouse,
} from "@/lib/supplier/warehouses/actions";
import type { Database } from "@/types/database";
import { LargeTitle } from "@/components/ui/large-title";

type WarehouseRow = Database["public"]["Tables"]["warehouses"]["Row"];

type Props = {
  supplierId: string;
  initialWarehouses: WarehouseRow[];
};

export function WarehousesClient({ supplierId, initialWarehouses }: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WarehouseRow | null>(null);
  const [pending, startTransition] = useTransition();

  const hasPrimary = initialWarehouses.some((w) => w.is_primary);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (w: WarehouseRow) => {
    setEditing(w);
    setDialogOpen(true);
  };

  const onArchive = (w: WarehouseRow) => {
    if (w.is_primary) {
      toast.error("Impossibile archiviare la sede principale");
      return;
    }
    if (
      !confirm(
        `Archiviare la sede "${w.name}"? Non sarà più attiva ma i dati saranno conservati.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await archiveWarehouse(supplierId, w.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Sede archiviata");
      router.refresh();
    });
  };

  const onSetPrimary = (w: WarehouseRow) => {
    if (
      !confirm(
        `Impostare "${w.name}" come sede principale? La sede principale attuale perderà il flag.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await setPrimaryWarehouse(supplierId, w.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Sede principale aggiornata");
      router.refresh();
    });
  };

  return (
    <div>
      {/* Mobile hero */}
      <div className="lg:hidden">
        <LargeTitle
          eyebrow={`${initialWarehouses.length} sedi configurate`}
          title="Sedi / Magazzini"
          subtitle="Esattamente una principale"
          actions={
            <button
              type="button"
              onClick={openNew}
              className="flex h-9 items-center gap-1 rounded-lg bg-[color:var(--color-brand-primary)] px-3 text-[13px] font-semibold text-[color:var(--color-brand-on-primary)] active:opacity-90"
              aria-label="Nuova sede"
            >
              <Plus className="h-3.5 w-3.5" /> Nuova
            </button>
          }
        />
      </div>

      {/* Desktop header */}
      <div className="hidden lg:flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Sedi / Magazzini</h1>
          <p className="text-sm text-sage mt-1">
            Gestisci i tuoi magazzini. Esattamente una sede deve essere
            principale.
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4" /> Nuova Sede
        </Button>
      </div>

      {initialWarehouses.length === 0 ? (
        <Card className="text-center py-16">
          <MapPin className="h-12 w-12 text-sage-muted mx-auto mb-4" />
          <p className="text-sage mb-4">Nessuna sede configurata.</p>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4" /> Aggiungi la prima sede
          </Button>
        </Card>
      ) : (
        <div
          className="cq-section grid gap-4"
          style={{
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
          }}
        >
          {initialWarehouses.map((w) => (
            <Card key={w.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-charcoal truncate">
                      {w.name}
                    </h3>
                    {w.is_primary && (
                      <Badge
                        variant="success"
                        className="text-[10px] bg-accent-green text-white ring-1 ring-accent-green/40"
                      >
                        <Star className="h-3 w-3 mr-1 fill-current" />{" "}
                        Principale
                      </Badge>
                    )}
                    {w.is_active ? (
                      <Badge
                        variant="default"
                        className="text-[10px] ring-1 ring-border-subtle"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Attivo
                      </Badge>
                    ) : (
                      <Badge
                        variant="default"
                        className="text-[10px] opacity-60"
                      >
                        <XCircle className="h-3 w-3 mr-1" /> Archiviato
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(w)}
                    className="p-1.5 rounded-lg hover:bg-surface-hover text-sage hover:text-charcoal"
                    aria-label="Modifica"
                    disabled={pending}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onArchive(w)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-sage hover:text-red-600 disabled:opacity-40"
                    aria-label="Archivia"
                    disabled={pending || w.is_primary || !w.is_active}
                    title={
                      w.is_primary
                        ? "Non puoi archiviare la sede principale"
                        : "Archivia"
                    }
                  >
                    <Archive className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 text-sm text-sage flex-1">
                {(w.address || w.city) && (
                  <div className="flex items-start gap-1.5">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      {[
                        w.address,
                        w.city,
                        w.province ? `(${w.province})` : null,
                        w.zip_code,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </div>
                )}
              </div>

              {!w.is_primary && w.is_active && (
                <button
                  onClick={() => onSetPrimary(w)}
                  disabled={pending}
                  className="mt-3 text-xs text-accent-green hover:underline self-start disabled:opacity-50"
                >
                  Imposta come principale
                </button>
              )}
            </Card>
          ))}
        </div>
      )}

      <WarehouseFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        supplierId={supplierId}
        warehouse={editing}
        hasPrimary={hasPrimary}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
