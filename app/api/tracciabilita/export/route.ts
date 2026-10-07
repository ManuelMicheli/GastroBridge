import "server-only";

import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getRestaurantContext } from "@/lib/restaurants/context";
import {
  filtersFromParams,
  formatExpiry,
  formatReceivedAt,
  queryRegistry,
  registryToCsv,
} from "@/lib/restaurants/receiving/registry";
import { ISSUE_LABELS } from "@/lib/restaurants/receiving/types";
import { RegistryPdfDocument } from "@/components/restaurant/haccp/registry-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fmtNum = (n: number | null) =>
  n === null ? "" : new Intl.NumberFormat("it-IT", { maximumFractionDigits: 3 }).format(n);

/** GET /api/tracciabilita/export?format=csv|pdf&q=&lot=&fornitore=&dal=&al=&richiamo=1 */
export async function GET(req: Request) {
  const ctx = await getRestaurantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const filters = filtersFromParams(sp);
  const recall = sp.richiamo === "1";
  const { rows, truncated, unavailable } = await queryRegistry(ctx.scopeIds, filters, 5000);
  if (unavailable) {
    return NextResponse.json({ error: "Registro non disponibile: applica le migrazioni del database." }, { status: 503 });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const base = recall ? `richiamo-${stamp}` : `registro-tracciabilita-${stamp}`;

  if (sp.format === "pdf") {
    const parts = [
      filters.q && `prodotto "${filters.q}"`,
      filters.lot && `lotto "${filters.lot}"`,
      filters.supplier && `fornitore "${filters.supplier}"`,
      filters.from && `dal ${formatExpiry(filters.from)}`,
      filters.to && `al ${formatExpiry(filters.to)}`,
      filters.onlyIssues && "solo non conformità",
    ].filter(Boolean);
    const buffer = (await renderToBuffer(
      RegistryPdfDocument({
        title: recall ? "Richiamo prodotto — ricevimenti" : "Registro di tracciabilità",
        restaurantName: ctx.restaurantName,
        generatedAt: formatReceivedAt(new Date().toISOString()),
        filtersLabel: parts.join(", "),
        truncated,
        rows: rows.map((r) => ({
          receivedAt: formatReceivedAt(r.receivedAt),
          supplier: r.supplierLabel,
          product: r.productName,
          lot: r.lotNumber ?? "—",
          expiry: formatExpiry(r.expiryDate),
          temperature: r.temperatureC === null ? "" : fmtNum(r.temperatureC),
          temperatureBad: r.temperatureOk === false,
          qty: `${fmtNum(r.receivedQty)}${r.unit ? ` ${r.unit}` : ""}`,
          outcome: ISSUE_LABELS[r.issue] + (r.note ? ` — ${r.note}` : ""),
          outcomeBad: r.issue !== "ok",
          ddt: r.ddtNumber ?? "",
        })),
      }),
    )) as unknown as Buffer;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${base}.pdf"`,
        "cache-control": "private, no-store",
      },
    });
  }

  return new NextResponse(registryToCsv(rows, ISSUE_LABELS), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${base}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
