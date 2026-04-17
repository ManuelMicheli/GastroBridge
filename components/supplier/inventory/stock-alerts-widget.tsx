import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";

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

  if (allGood) {
    return (
      <Link
        href="/supplier/magazzino"
        className="flex items-center gap-2.5 rounded-lg border border-accent-green/40 bg-accent-green/10 px-3 py-2 hover:bg-accent-green/15 transition-colors"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0 text-accent-green" aria-hidden />
        <span className="text-xs font-medium text-text-primary">
          Magazzino in salute
        </span>
        <span className="ml-auto text-xs text-text-tertiary">Apri →</span>
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {lowStockCount > 0 && (
        <Link
          href="/supplier/magazzino?filter=low"
          className="flex items-center gap-2 rounded-lg border border-accent-red/30 bg-accent-red/10 px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-accent-red/20 transition-colors"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-accent-red" aria-hidden />
          <span>
            <b className="text-accent-red">{lowStockCount}</b> sotto scorta
          </span>
        </Link>
      )}
      {expiringCount > 0 && (
        <Link
          href="/supplier/magazzino/lotti?expiring=7"
          className="flex items-center gap-2 rounded-lg border border-accent-amber/40 bg-accent-amber/10 px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-accent-amber/20 transition-colors"
        >
          <CalendarClock className="h-3.5 w-3.5 shrink-0 text-accent-amber" aria-hidden />
          <span>
            <b className="text-accent-amber">{expiringCount}</b>{" "}
            {expiringCount === 1 ? "lotto in scadenza" : "lotti in scadenza"} (≤7gg)
          </span>
        </Link>
      )}
      <Link
        href="/supplier/magazzino"
        className="text-xs text-text-link hover:text-accent-green transition-colors ml-auto"
      >
        Apri magazzino →
      </Link>
    </div>
  );
}
