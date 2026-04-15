import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { listMovements } from "@/lib/supplier/stock/actions";

export const metadata: Metadata = { title: "Carichi magazzino" };

type SearchParams = Promise<{ from?: string; to?: string; warehouseId?: string }>;

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatQty(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "-";
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 3 }).format(Number(n));
}

function formatCost(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "-";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 4,
  }).format(Number(n));
}

export default async function CarichiListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("profile_id", user?.id ?? "")
    .maybeSingle<{ id: string }>();

  if (!supplier?.id) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-text-primary mb-6">Carichi</h1>
        <Card className="text-center py-16">
          <p className="text-text-secondary">
            Nessun profilo fornitore associato a questo utente.
          </p>
        </Card>
      </div>
    );
  }

  // Default period: ultimi 30 giorni.
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const defaultFromStr = defaultFrom.toISOString().slice(0, 10);
  const defaultToStr = now.toISOString().slice(0, 10);
  const fromStr = params.from ?? defaultFromStr;
  const toStr = params.to ?? defaultToStr;

  // Convert YYYY-MM-DD range → ISO datetime bounds.
  const fromIso = `${fromStr}T00:00:00.000Z`;
  const toIso = `${toStr}T23:59:59.999Z`;

  const result = await listMovements({
    supplierId: supplier.id,
    movementType: "receive",
    warehouseId: params.warehouseId,
    from: fromIso,
    to: toIso,
    limit: 200,
  });

  const rows = result.ok ? result.data : [];

  // Enrich con lot_code + cost_per_base dal lotto creato dal carico.
  const lotIds = Array.from(
    new Set(rows.map((r) => r.lot_id).filter((v): v is string => Boolean(v))),
  );
  const lotInfo = new Map<string, { lot_code: string; cost_per_base: number | null }>();
  if (lotIds.length > 0) {
    const { data: lots } = await supabase
      .from("stock_lots")
      .select("id, lot_code, cost_per_base")
      .in("id", lotIds)
      .returns<Array<{ id: string; lot_code: string; cost_per_base: number | null }>>();
    for (const l of lots ?? []) {
      lotInfo.set(l.id, { lot_code: l.lot_code, cost_per_base: l.cost_per_base });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">Carichi</h1>
          <p className="text-sm text-text-secondary">
            Storico carichi da fornitore e ingressi in magazzino.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <form className="flex items-end gap-2" action="/supplier/magazzino/carichi">
            <label className="block text-sm">
              <span className="text-xs text-text-secondary">Dal</span>
              <input
                type="date"
                name="from"
                defaultValue={fromStr}
                className="mt-1 block rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs text-text-secondary">Al</span>
              <input
                type="date"
                name="to"
                defaultValue={toStr}
                className="mt-1 block rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
              />
            </label>
            <button
              type="submit"
              className="px-3 py-2 rounded-lg border border-border-subtle text-sm text-text-secondary hover:bg-surface-hover"
            >
              Filtra
            </button>
          </form>
          <Link
            href="/supplier/magazzino/carichi/nuovo"
            className="px-4 py-2 rounded-lg bg-accent-green text-surface-base font-medium"
          >
            Nuovo carico
          </Link>
        </div>
      </div>

      {!result.ok ? (
        <Card className="text-center py-16">
          <p className="text-red-500">{result.error}</p>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="text-center py-16">
          <p className="text-text-secondary">
            Nessun carico nel periodo selezionato.
          </p>
          <Link
            href="/supplier/magazzino/carichi/nuovo"
            className="mt-4 inline-block text-accent-green hover:underline"
          >
            Registra il primo carico
          </Link>
        </Card>
      ) : (
        <div className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-base/40 text-left text-xs uppercase tracking-wide text-text-secondary">
                <tr>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Prodotto</th>
                  <th className="px-4 py-3 font-medium">Magazzino</th>
                  <th className="px-4 py-3 font-medium">Lotto</th>
                  <th className="px-4 py-3 font-medium text-right">Qty base</th>
                  <th className="px-4 py-3 font-medium text-right">Costo/base</th>
                  <th className="px-4 py-3 font-medium">Operatore</th>
                  <th className="px-4 py-3 font-medium">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {rows.map((r) => {
                  const lot = r.lot_id ? lotInfo.get(r.lot_id) : undefined;
                  return (
                  <tr key={r.id} className="hover:bg-surface-hover/40">
                    <td className="px-4 py-3 text-text-primary whitespace-nowrap">
                      {formatDate(r.created_at)}
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      {r.product_name || "-"}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {r.warehouse_name || "-"}
                    </td>
                    <td className="px-4 py-3 text-text-secondary font-mono text-xs">
                      {lot?.lot_code ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-text-primary tabular-nums">
                      {formatQty(r.quantity_base)}
                    </td>
                    <td className="px-4 py-3 text-right text-text-primary tabular-nums">
                      {formatCost(lot?.cost_per_base ?? null)}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {r.created_by_name ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-text-secondary max-w-xs truncate">
                      {r.notes ?? "-"}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
