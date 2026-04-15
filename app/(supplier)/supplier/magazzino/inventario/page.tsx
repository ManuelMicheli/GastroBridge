import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveSupplierMember,
  requireSupplierMember,
} from "@/lib/supplier/context";
import {
  getLots,
  getStockOverview,
  getWarehousesForCurrentMember,
} from "@/lib/supplier/stock/queries";
import { hasPermission } from "@/lib/supplier/permissions";
import type { SupplierRole } from "@/types/database";
import { InventarioClient } from "./adjust-client";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function InventarioPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle<{ id: string }>();

  if (!supplier?.id) {
    return (
      <div className="rounded-lg border border-border-subtle bg-surface-card p-6 text-sm text-text-secondary">
        Nessun profilo fornitore associato al tuo account.
      </div>
    );
  }

  const supplierId = supplier.id;
  const member = (await getActiveSupplierMember(supplierId)) as
    | { id: string; role: SupplierRole; supplier_id: string }
    | null;

  if (!member) {
    // forza 403 lato layout/logica superiore
    await requireSupplierMember(supplierId);
  }

  const role = (member?.role ?? null) as SupplierRole | null;
  const canAdjust = role ? hasPermission(role, "stock.adjust") : false;

  if (!canAdjust) {
    return (
      <section className="space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-text-primary">
            Inventario
          </h1>
          <p className="text-sm text-text-secondary">
            Rettifica inventariale (conteggio fisico, scarichi, danni).
          </p>
        </header>
        <div className="rounded-lg border border-accent-amber/40 bg-accent-amber/10 p-6 text-sm text-accent-amber">
          Permesso <code>stock.adjust</code> mancante. Contatta l&apos;amministratore
          del fornitore per richiedere l&apos;accesso a questa sezione.
        </div>
      </section>
    );
  }

  const warehouses = await getWarehousesForCurrentMember(supplierId);

  const requestedWarehouse =
    typeof params.warehouse === "string" ? params.warehouse : undefined;
  const selectedWarehouseId =
    (requestedWarehouse &&
      warehouses.find((w) => w.id === requestedWarehouse)?.id) ||
    warehouses.find((w) => w.is_primary)?.id ||
    warehouses[0]?.id ||
    null;

  // Overview e lotti del warehouse selezionato (se presente).
  const [overview, lots] = selectedWarehouseId
    ? await Promise.all([
        getStockOverview(supplierId, selectedWarehouseId),
        getLots(supplierId, {
          warehouseId: selectedWarehouseId,
          onlyWithStock: false,
        }),
      ])
    : [[], []];

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-text-primary">Inventario</h1>
        <p className="text-sm text-text-secondary">
          Rettifica rapida o conteggio fisico bulk. Ogni modifica genera un
          movimento di magazzino tracciato.
        </p>
      </header>

      {warehouses.length === 0 ? (
        <div className="rounded-lg border border-border-subtle bg-surface-card p-6 text-sm text-text-secondary">
          Nessun magazzino attivo. Configurane uno in
          <span className="mx-1 font-medium text-text-primary">
            Impostazioni &rarr; Sedi
          </span>
          prima di procedere.
        </div>
      ) : (
        <InventarioClient
          supplierId={supplierId}
          warehouses={warehouses.map((w) => ({
            id: w.id,
            name: w.name,
            isPrimary: w.is_primary,
          }))}
          selectedWarehouseId={selectedWarehouseId}
          overview={overview.map((o) => ({
            productId: o.product_id,
            productName: o.product_name,
            warehouseId: o.warehouse_id,
            quantityBase: o.quantity_base,
            availableBase: o.available_base,
          }))}
          lots={lots.map((l) => ({
            id: l.id,
            productId: l.product_id,
            productName: l.product_name,
            lotCode: l.lot_code,
            expiryDate: l.expiry_date,
            quantityBase: Number(l.quantity_base),
            quantityReservedBase: Number(l.quantity_reserved_base),
          }))}
        />
      )}
    </section>
  );
}
