import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFinanceAccess } from "@/lib/invoices/server/access";
import { getInvoiceDetail, getLinkOptions } from "@/lib/invoices/server/queries";
import { NoFinanceAccess } from "../../_components/finance-bits";
import { InvoiceDetailClient } from "./invoice-detail-client";

export const metadata: Metadata = { title: "Fattura fornitore" };

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const access = await getFinanceAccess("read");
  if (!access.ok) return <NoFinanceAccess message={access.error} />;
  const { db, ctx, canWrite } = access;
  const detail = await getInvoiceDetail(db, ctx.restaurantId, id);
  if (!detail) notFound();
  const needsLink = canWrite && !detail.invoice.supplier_id && !detail.invoice.catalog_id;
  const linkOptions = needsLink ? await getLinkOptions(db, ctx.restaurantId) : null;
  return <InvoiceDetailClient detail={detail} canWrite={canWrite} restaurantName={ctx.restaurantName} linkOptions={linkOptions} />;
}
