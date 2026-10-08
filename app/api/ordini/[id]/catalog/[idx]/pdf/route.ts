import "server-only";

import { NextResponse } from "next/server";
import { buildCatalogBlockPdf } from "@/lib/orders/catalog-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; idx: string }> },
) {
  const { id: orderId, idx } = await params;
  const res = await buildCatalogBlockPdf(orderId, Number(idx));
  if ("error" in res) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return new NextResponse(new Uint8Array(res.buffer), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${res.filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
