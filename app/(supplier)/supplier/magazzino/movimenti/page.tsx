import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { listMovements } from "@/lib/supplier/stock/actions";
import {
  getWarehousesForCurrentMember,
  type MovementRow,
} from "@/lib/supplier/stock/queries";
import { MovementsClient } from "./movements-client";
import type { StockMovementType } from "@/types/database";

export const metadata: Metadata = { title: "Movimenti — Magazzino" };

type SearchParams = Promise<{
  warehouse?: string;
  product?: string;
  type?: string;
  from?: string;
  to?: string;
  limit?: string;
}>;

const MOVEMENT_TYPES: StockMovementType[] = [
  "receive",
  "order_reserve",
  "order_unreserve",
  "order_ship",
  "adjust_in",
  "adjust_out",
  "return",
  "transfer",
];

function isMovementType(v: string | undefined): v is StockMovementType {
  return !!v && (MOVEMENT_TYPES as string[]).includes(v);
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

export default async function MovimentiPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Card className="text-center py-16">
        <p className="text-text-secondary">Sessione non valida.</p>
      </Card>
    );
  }

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle<{ id: string }>();

  if (!supplier?.id) {
    return (
      <Card className="text-center py-16">
        <p className="text-text-secondary">
          Nessun profilo fornitore associato a questo utente.
        </p>
      </Card>
    );
  }

  const supplierId = supplier.id;

  // Default periodo: ultimi 7 giorni.
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const defaultFromStr = defaultFrom.toISOString().slice(0, 10);
  const defaultToStr = now.toISOString().slice(0, 10);
  const fromStr = params.from?.trim() || defaultFromStr;
  const toStr = params.to?.trim() || defaultToStr;

  const fromIso = `${fromStr}T00:00:00.000Z`;
  const toIso = `${toStr}T23:59:59.999Z`;

  const warehouseId = params.warehouse?.trim() || undefined;
  const productId = params.product?.trim() || undefined;
  const movementType = isMovementType(params.type) ? params.type : undefined;

  const parsedLimit = Number(params.limit ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(Math.floor(parsedLimit), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  // Fetch movimenti + warehouses + prodotti del fornitore (per dropdown).
  let movements: MovementRow[] = [];
  let loadError: string | null = null;

  const res = await listMovements({
    supplierId,
    warehouseId,
    productId,
    movementType,
    from: fromIso,
    to: toIso,
    limit,
  });
  if (!res.ok) {
    loadError = res.error;
  } else {
    movements = res.data;
  }

  let warehouses: Awaited<ReturnType<typeof getWarehousesForCurrentMember>> = [];
  try {
    warehouses = await getWarehousesForCurrentMember(supplierId);
  } catch {
    warehouses = [];
  }

  const { data: productsRaw } = await supabase
    .from("products")
    .select("id, name")
    .eq("supplier_id", supplierId)
    .eq("is_active", true)
    .order("name", { ascending: true })
    .returns<Array<{ id: string; name: string }>>();

  const products = productsRaw ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-text-primary">Movimenti</h1>
        <p className="text-sm text-text-secondary">
          Audit log di tutti i movimenti di magazzino: carichi, rettifiche,
          prenotazioni ordine, spedizioni, resi e trasferimenti.
        </p>
      </div>

      {loadError ? (
        <Card className="text-center py-16">
          <p className="text-sm text-accent-red">{loadError}</p>
        </Card>
      ) : (
        <MovementsClient
          movements={movements}
          warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))}
          products={products}
          filters={{
            warehouse: warehouseId ?? "",
            product: productId ?? "",
            type: movementType ?? "",
            from: fromStr,
            to: toStr,
            limit,
          }}
          defaultLimit={DEFAULT_LIMIT}
          maxLimit={MAX_LIMIT}
        />
      )}
    </div>
  );
}
