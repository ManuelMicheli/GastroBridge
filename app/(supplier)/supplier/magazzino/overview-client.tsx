"use client";

import { useState } from "react";
import { LowStockBanner } from "@/components/supplier/inventory/low-stock-banner";
import { StockOverviewTable } from "@/components/supplier/inventory/stock-overview-table";
import type { StockOverviewRow } from "@/lib/supplier/stock/queries";

type Props = {
  items: StockOverviewRow[];
  hideWarehouseColumn?: boolean;
};

/**
 * Wrapper client della pagina giacenze: collega il banner "sotto scorta"
 * con il toggle filtro della tabella.
 */
export function MagazzinoOverviewClient({ items, hideWarehouseColumn }: Props) {
  const [onlyLow, setOnlyLow] = useState(false);
  const lowCount = items.filter((r) => r.is_low).length;

  return (
    <div className="space-y-4">
      <LowStockBanner count={lowCount} onShowAll={() => setOnlyLow(true)} />
      <StockOverviewTable
        items={items}
        hideWarehouseColumn={hideWarehouseColumn}
        onlyLowStock={onlyLow}
        onToggleLowStock={setOnlyLow}
      />
    </div>
  );
}
