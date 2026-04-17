// Task 9 (Plan 1D) — Dettaglio DDT: header + anteprima + azioni.
//
// Pattern server:
//   1. Auth + ruolo + feature flag.
//   2. Carica ddt_documents (via admin, RLS già mediato da appartenenza).
//   3. Genera signed URL 5 min per embed iframe.
//   4. Delega UI a <DdtPreview />.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { ArrowLeft, FileText } from "lucide-react";
import { DDT_BUCKET } from "@/lib/supplier/ddt/render";
import { hasPermission } from "@/lib/supplier/permissions";
import type { DdtCausale, SupplierRole } from "@/types/database";
import { DdtPreview } from "@/components/supplier/ddt/ddt-preview";

export const metadata: Metadata = { title: "Dettaglio DDT" };

const CAUSALE_LABEL: Record<DdtCausale, string> = {
  sale: "Vendita",
  consignment: "Conto visione",
  return: "Reso",
  transfer: "Trasferimento",
  sample: "Campione",
  cancel: "Storno",
};
const CAUSALE_VARIANT: Record<DdtCausale, BadgeVariant> = {
  sale: "success",
  consignment: "info",
  return: "warning",
  transfer: "info",
  sample: "info",
  cancel: "warning",
};

type LineItem = {
  id: string;
  product_name: string;
  sku: string | null;
  unit: string;
  quantity: number;
  lot_code: string | null;
  expiry_date: string | null;
};

export default async function SupplierDdtDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <Card className="py-16 text-center">
        <p className="text-sage">Sessione non valida.</p>
      </Card>
    );
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const admin = createAdminClient() as unknown as {
    from: (t: string) => any;
    storage: {
      from: (b: string) => {
        createSignedUrl: (
          p: string,
          ttl: number,
        ) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
      };
    };
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const { data: ddt } = (await admin
    .from("ddt_documents")
    .select(
      "id, supplier_id, delivery_id, number, year, causale, issued_at, recipient_snapshot, vettore, peso_kg, colli, pdf_url, canceled_at, canceled_reason",
    )
    .eq("id", id)
    .maybeSingle()) as {
    data: {
      id: string;
      supplier_id: string;
      delivery_id: string;
      number: number;
      year: number;
      causale: DdtCausale;
      issued_at: string;
      recipient_snapshot: Record<string, unknown> | null;
      vettore: string | null;
      peso_kg: number | null;
      colli: number | null;
      pdf_url: string;
      canceled_at: string | null;
      canceled_reason: string | null;
    } | null;
  };

  if (!ddt) notFound();

  // Auth check: membro del supplier + permesso.
  const { data: member } = await supabase
    .from("supplier_members")
    .select("id, role, supplier_id")
    .eq("profile_id", user.id)
    .eq("supplier_id", ddt.supplier_id)
    .eq("is_active", true)
    .not("accepted_at", "is", null)
    .maybeSingle<{ id: string; role: SupplierRole; supplier_id: string }>();

  if (!member || !hasPermission(member.role, "ddt.generate")) {
    notFound();
  }

  // Caricamento righe delivery per la preview dati.
  const { data: linesRaw } = (await admin
    .from("delivery_items")
    .select(
      `
        id,
        quantity_sales_unit,
        order_split_item_id,
        stock_lots:lot_id ( lot_code, expiry_date ),
        order_split_items:order_split_item_id (
          products:product_id ( name, sku, unit )
        )
      `,
    )
    .eq("delivery_id", ddt.delivery_id)) as { data: unknown[] | null };

  const pickOne = <T,>(v: T | T[] | null | undefined): T | null => {
    if (v == null) return null;
    if (Array.isArray(v)) return v[0] ?? null;
    return v;
  };
  const toNumber = (v: unknown): number => {
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  };

  const lines: LineItem[] = (linesRaw ?? []).map((raw) => {
    const r = raw as {
      id: string;
      quantity_sales_unit: number | string;
      stock_lots:
        | { lot_code: string | null; expiry_date: string | null }
        | Array<{ lot_code: string | null; expiry_date: string | null }>
        | null;
      order_split_items:
        | {
            products:
              | { name: string | null; sku: string | null; unit: string | null }
              | Array<{ name: string | null; sku: string | null; unit: string | null }>
              | null;
          }
        | Array<{
            products:
              | { name: string | null; sku: string | null; unit: string | null }
              | Array<{ name: string | null; sku: string | null; unit: string | null }>
              | null;
          }>
        | null;
    };
    const lot = pickOne(r.stock_lots);
    const splitItem = pickOne(r.order_split_items);
    const product = pickOne(splitItem?.products ?? null);
    return {
      id: r.id,
      product_name: product?.name ?? "(prodotto)",
      sku: product?.sku ?? null,
      unit: product?.unit ?? "pz",
      quantity: toNumber(r.quantity_sales_unit),
      lot_code: lot?.lot_code ?? null,
      expiry_date: lot?.expiry_date ?? null,
    };
  });

  // Signed URL 5 min per iframe preview.
  const { data: signed } = await admin.storage
    .from(DDT_BUCKET)
    .createSignedUrl(ddt.pdf_url, 5 * 60);
  const signedUrl = signed?.signedUrl ?? null;

  const recipientName =
    (ddt.recipient_snapshot?.name as string | undefined) ?? "Destinatario";
  const recipientAddress = [
    ddt.recipient_snapshot?.address,
    [ddt.recipient_snapshot?.postal_code, ddt.recipient_snapshot?.city]
      .filter(Boolean)
      .join(" "),
    ddt.recipient_snapshot?.province,
  ]
    .filter(Boolean)
    .join(", ");

  const canAdmin = member.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Link
            href="/supplier/ddt"
            className="inline-flex items-center gap-1 text-sm text-sage hover:text-forest"
          >
            <ArrowLeft className="h-4 w-4" /> Libro DDT
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-charcoal">
            DDT n. {ddt.number}/{ddt.year}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={CAUSALE_VARIANT[ddt.causale]}>
              {CAUSALE_LABEL[ddt.causale]}
            </Badge>
            {ddt.canceled_at ? (
              <Badge variant="warning">
                Annullato il{" "}
                {new Date(ddt.canceled_at).toLocaleDateString("it-IT")}
              </Badge>
            ) : (
              <Badge variant="outline">Valido</Badge>
            )}
          </div>
        </div>
      </div>

      {ddt.canceled_at && ddt.canceled_reason && (
        <Card className="border border-terracotta/40 bg-terracotta-light/30">
          <p className="text-xs uppercase tracking-wider text-terracotta">
            Motivo annullamento
          </p>
          <p className="mt-1 text-sm text-charcoal">{ddt.canceled_reason}</p>
        </Card>
      )}

      <div
        className="cq-section grid gap-4"
        style={{
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
        }}
      >
        <Card>
          <p className="text-xs uppercase tracking-wider text-sage">
            Data emissione
          </p>
          <p className="mt-1 text-lg font-bold text-charcoal">
            {new Date(ddt.issued_at).toLocaleDateString("it-IT", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wider text-sage">
            Destinatario
          </p>
          <p className="mt-1 font-bold text-charcoal">{recipientName}</p>
          {recipientAddress && (
            <p className="text-xs text-sage">{recipientAddress}</p>
          )}
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wider text-sage">
            Trasporto
          </p>
          <p className="mt-1 text-sm text-charcoal">
            {ddt.vettore ?? "Mittente"}
          </p>
          <p className="text-xs text-sage">
            {ddt.colli != null ? `${ddt.colli} colli` : "—"}
            {ddt.peso_kg != null ? ` · ${ddt.peso_kg} kg` : ""}
          </p>
        </Card>
      </div>

      <DdtPreview
        ddtId={ddt.id}
        deliveryId={ddt.delivery_id}
        signedUrl={signedUrl}
        canAdmin={canAdmin}
        canCancel={!ddt.canceled_at && ddt.causale !== "cancel"}
        lines={lines}
      />

      {lines.length === 0 && (
        <Card className="py-8 text-center">
          <FileText className="mx-auto mb-2 h-8 w-8 text-sage-muted" />
          <p className="text-sm text-sage">Nessuna riga trovata.</p>
        </Card>
      )}
    </div>
  );
}
