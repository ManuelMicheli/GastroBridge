"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, MapPin, Phone, Users, Pencil, Trash2, Star } from "lucide-react";
import { LocationFormDialog } from "@/components/settings/location-form-dialog";
import { deleteLocation, setPrimaryLocation } from "@/lib/restaurants/actions";
import type { RestaurantRow } from "@/lib/restaurants/types";

const CUISINE_LABELS: Record<string, string> = {
  italiana: "Italiana",
  pizzeria: "Pizzeria",
  pesce: "Pesce",
  carne: "Carne",
  giapponese: "Giapponese",
  fusion: "Fusion",
  bistrot: "Bistrot",
  trattoria: "Trattoria",
  gourmet: "Gourmet",
  altro: "Altro",
};

export function SediClient({ initialLocations }: { initialLocations: RestaurantRow[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RestaurantRow | null>(null);
  const [pending, startTransition] = useTransition();

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (loc: RestaurantRow) => {
    setEditing(loc);
    setDialogOpen(true);
  };

  const onDelete = (loc: RestaurantRow) => {
    if (!confirm(`Eliminare la sede "${loc.name}"? Questa azione è irreversibile.`)) return;
    startTransition(async () => {
      const res = await deleteLocation(loc.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Sede eliminata");
      router.refresh();
    });
  };

  const onSetPrimary = (loc: RestaurantRow) => {
    startTransition(async () => {
      const res = await setPrimaryLocation(loc.id);
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-charcoal">Sedi</h1>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4" /> Nuova Sede
        </Button>
      </div>

      {initialLocations.length === 0 ? (
        <Card className="text-center py-16">
          <MapPin className="h-12 w-12 text-sage-muted mx-auto mb-4" />
          <p className="text-sage mb-4">Nessuna sede configurata.</p>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4" /> Aggiungi la prima sede
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {initialLocations.map((loc) => (
            <Card key={loc.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-charcoal truncate">{loc.name}</h3>
                    {loc.is_primary && (
                      <Badge
                        variant="success"
                        className="text-[10px] bg-accent-green text-white ring-1 ring-accent-green/40"
                      >
                        <Star className="h-3 w-3 mr-1 fill-current" /> Principale
                      </Badge>
                    )}
                  </div>
                  {loc.cuisine && (
                    <p className="text-xs text-sage mt-0.5">
                      {CUISINE_LABELS[loc.cuisine] ?? loc.cuisine}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(loc)}
                    className="p-1.5 rounded-lg hover:bg-surface-hover text-sage hover:text-charcoal"
                    aria-label="Modifica"
                    disabled={pending}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(loc)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-sage hover:text-red-600"
                    aria-label="Elimina"
                    disabled={pending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 text-sm text-sage flex-1">
                {(loc.address || loc.city) && (
                  <div className="flex items-start gap-1.5">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      {[loc.address, loc.city, loc.province ? `(${loc.province})` : null, loc.zip_code]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </div>
                )}
                {loc.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-4 w-4" /> {loc.phone}
                  </div>
                )}
                {loc.covers !== null && (
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" /> {loc.covers} coperti
                  </div>
                )}
              </div>

              {!loc.is_primary && (
                <button
                  onClick={() => onSetPrimary(loc)}
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

      <LocationFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        location={editing}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
