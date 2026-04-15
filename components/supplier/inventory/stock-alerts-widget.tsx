import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, Warehouse } from "lucide-react";
import { DarkCard, DarkCardHeader, DarkCardTitle } from "@/components/dashboard/cards/dark-card";

type Props = {
  lowStockCount: number;
  expiringCount: number;
};

/**
 * Widget "Alert magazzino" mostrato nella dashboard supplier. Due contatori
 * (prodotti sotto scorta, lotti in scadenza <=7gg) con link diretti a:
 *  - /supplier/magazzino?filter=low
 *  - /supplier/magazzino/lotti?expiring=7
 * Se entrambi i contatori sono 0, card verde "Magazzino in salute".
 *
 * Server component puro: accetta solo i due numeri gia calcolati dalla page.
 */
export function StockAlertsWidget({ lowStockCount, expiringCount }: Props) {
  const allGood = lowStockCount === 0 && expiringCount === 0;

  return (
    <DarkCard>
      <DarkCardHeader>
        <DarkCardTitle>Alert magazzino</DarkCardTitle>
        <Link
          href="/supplier/magazzino"
          className="text-xs text-text-link hover:text-accent-green transition-colors"
        >
          Apri magazzino →
        </Link>
      </DarkCardHeader>

      {allGood ? (
        <div className="flex items-center gap-3 rounded-lg border border-accent-green/40 bg-accent-green/10 px-3 py-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-accent-green" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold text-text-primary">Magazzino in salute</p>
            <p className="text-xs text-text-secondary">
              Nessun prodotto sotto scorta, nessun lotto in scadenza ravvicinata.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Link
            href="/supplier/magazzino?filter=low"
            className="flex items-center gap-3 rounded-lg border border-accent-red/30 bg-accent-red/10 px-3 py-2.5 transition-colors hover:bg-accent-red/20"
          >
            <AlertTriangle className="h-5 w-5 shrink-0 text-accent-red" aria-hidden />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary">
                {lowStockCount} sotto scorta
              </p>
              <p className="text-xs text-text-secondary">
                Disponibile sotto la soglia configurata.
              </p>
            </div>
            <span className="text-xs font-medium text-accent-red">Vedi →</span>
          </Link>

          <Link
            href="/supplier/magazzino/lotti?expiring=7"
            className="flex items-center gap-3 rounded-lg border border-accent-amber/40 bg-accent-amber/10 px-3 py-2.5 transition-colors hover:bg-accent-amber/20"
          >
            <CalendarClock className="h-5 w-5 shrink-0 text-accent-amber" aria-hidden />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary">
                {expiringCount} lott{expiringCount === 1 ? "o" : "i"} in scadenza (≤7gg)
              </p>
              <p className="text-xs text-text-secondary">
                Pianifica vendita / movimentazione.
              </p>
            </div>
            <span className="text-xs font-medium text-accent-amber">Vedi →</span>
          </Link>

          <Link
            href="/supplier/magazzino/carichi/nuovo"
            className="flex items-center gap-2 rounded-lg border border-border-default bg-surface-base px-3 py-2 text-xs text-text-secondary transition-colors hover:text-text-primary"
          >
            <Warehouse className="h-4 w-4" aria-hidden />
            Registra nuovo carico
          </Link>
        </div>
      )}
    </DarkCard>
  );
}
