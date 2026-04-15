import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  DdtPdfDocument,
  type DdtCausale,
  type DdtLineRow,
  type DdtParty,
  type DdtPdfData,
} from "@/components/supplier/ddt/ddt-pdf-document";

/**
 * Notable deviations from the plan prose:
 *   - React-PDF's `renderToBuffer` returns `Promise<Buffer>` but its type
 *     definitions report `NodeJS.ReadableStream` in some published versions.
 *     We force the node runtime explicitly via a top-level `server-only`
 *     import and cast through `unknown` at the call site.
 *   - The DDT storage path uses the plan-specified shape
 *     `{supplier_id}/{year}/{number}.pdf` (no leading slash — Supabase
 *     storage keys must not begin with `/`).
 *   - Signed URL TTL defaults to 1 hour; the server action (Task 8) can ask
 *     for a longer one when it needs to embed it in a notification email.
 */

export const DDT_BUCKET = "ddt-pdfs";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1h

export interface RenderDdtOptions {
  /** If true, a "COPIA" watermark is rendered diagonally across the page. */
  copia?: boolean;
  /** Signed URL expiry (default 1h). */
  signedUrlTtlSeconds?: number;
  /**
   * Optional suffix appended to the storage key before `.pdf`. Used by the
   * COPIA reprint flow (Task 8) to avoid overwriting the canonical DDT PDF
   * with a watermarked variant. Must be URL-safe; leading separator is
   * caller-provided (e.g. `-copy-1713190000000`).
   */
  pathSuffix?: string;
}

export interface RenderDdtResult {
  /** `{supplier_id}/{year}/{number}.pdf` — canonical storage key. */
  path: string;
  /** Signed URL scoped to `DDT_BUCKET`. */
  signedUrl: string;
  /** Byte length of the generated PDF. */
  size: number;
}

/**
 * Render DDT `ddtId` to PDF, upload to the `ddt-pdfs` bucket and return a
 * signed URL. Uses the service-role admin client so RLS is bypassed — the
 * caller (server action / RPC) must already have validated the user has
 * `ddt.generate` on the supplier.
 */
export async function renderDdtPdf(
  ddtId: string,
  options: RenderDdtOptions = {},
): Promise<RenderDdtResult> {
  const admin = createAdminClient();
  // Phase-1D tables participate in advanced PostgREST embeds that don't type-
  // narrow cleanly through the generated Database types, so we deliberately
  // use a loosened client handle (matches the dashboard-queries pattern).
  // Shapes are validated via narrow interfaces declared below.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loose = admin as unknown as { from: (t: string) => any };

  type DdtRow = {
    id: string;
    supplier_id: string;
    delivery_id: string;
    number: number;
    year: number;
    causale: string;
    issued_at: string;
    recipient_snapshot: unknown;
    vettore: string | null;
    peso_kg: number | string | null;
    colli: number | null;
    template_id: string | null;
  };

  const { data: ddtRaw, error: ddtErr } = await loose
    .from("ddt_documents")
    .select(
      "id, supplier_id, delivery_id, number, year, causale, issued_at, recipient_snapshot, vettore, peso_kg, colli, template_id",
    )
    .eq("id", ddtId)
    .maybeSingle();
  const ddt = ddtRaw as DdtRow | null;

  if (ddtErr) throw new Error(`ddt fetch failed: ${ddtErr.message}`);
  if (!ddt) throw new Error(`ddt ${ddtId} not found`);

  type SupplierRow = {
    company_name: string;
    address: string | null;
    city: string | null;
    province: string | null;
    zip_code: string | null;
    phone: string | null;
    email: string | null;
    fiscal_code: string | null;
    rea_number: string | null;
  };
  type TemplateRow = {
    logo_url: string | null;
    primary_color: string | null;
    header_html: string | null;
    footer_html: string | null;
    conditions_text: string | null;
  };
  type DeliveryRow = {
    id: string;
    notes: string | null;
    scheduled_date: string;
  };
  type DeliveryItemRow = {
    id: string;
    quantity_base: number | string;
    quantity_sales_unit: number | string;
    order_split_item_id: string;
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

  const [
    { data: supplierRaw, error: supErr },
    { data: templateRaw, error: tplErr },
    { data: deliveryRaw, error: delErr },
    { data: linesRaw, error: linErr },
  ] = await Promise.all([
    loose
      .from("suppliers")
      .select(
        "company_name, address, city, province, zip_code, phone, email, fiscal_code, rea_number",
      )
      .eq("id", ddt.supplier_id)
      .maybeSingle(),
    ddt.template_id
      ? loose
          .from("ddt_templates")
          .select(
            "logo_url, primary_color, header_html, footer_html, conditions_text",
          )
          .eq("id", ddt.template_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as {
          data: null;
          error: null;
        }),
    loose
      .from("deliveries")
      .select("id, notes, scheduled_date")
      .eq("id", ddt.delivery_id)
      .maybeSingle(),
    loose
      .from("delivery_items")
      .select(
        `
          id,
          quantity_base,
          quantity_sales_unit,
          order_split_item_id,
          stock_lots:lot_id ( lot_code, expiry_date ),
          order_split_items:order_split_item_id (
            products:product_id ( name, sku, unit )
          )
        `,
      )
      .eq("delivery_id", ddt.delivery_id),
  ]);

  const supplier = supplierRaw as SupplierRow | null;
  const template = templateRaw as TemplateRow | null;
  const delivery = deliveryRaw as DeliveryRow | null;
  const lines = linesRaw as DeliveryItemRow[] | null;

  if (supErr) throw new Error(`supplier fetch failed: ${supErr.message}`);
  if (tplErr) throw new Error(`template fetch failed: ${tplErr.message}`);
  if (delErr) throw new Error(`delivery fetch failed: ${delErr.message}`);
  if (linErr) throw new Error(`delivery_items fetch failed: ${linErr.message}`);
  if (!supplier) throw new Error(`supplier ${ddt.supplier_id} not found`);
  if (!delivery) throw new Error(`delivery ${ddt.delivery_id} not found`);

  const supplierParty: DdtParty = {
    name: supplier.company_name,
    vat: null,
    fiscal_code: supplier.fiscal_code,
    rea: supplier.rea_number,
    address: supplier.address,
    city: supplier.city,
    postal_code: supplier.zip_code,
    province: supplier.province,
    country: "Italia",
    phone: supplier.phone,
    email: supplier.email,
  };

  const recipientParty = normalizeRecipient(ddt.recipient_snapshot);

  const toNumber = (v: unknown, fallback = 0): number => {
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    }
    return fallback;
  };
  const pickOne = <T,>(v: T | T[] | null | undefined): T | null => {
    if (v == null) return null;
    if (Array.isArray(v)) return v[0] ?? null;
    return v;
  };

  const pdfLines: DdtLineRow[] = (lines ?? []).map(
    (row, idx): DdtLineRow => {
      const lot = pickOne(row.stock_lots);
      const splitItem = pickOne(row.order_split_items);
      const product = pickOne(splitItem?.products ?? null);

      return {
        position: idx + 1,
        product_name: product?.name ?? "(prodotto)",
        sku: product?.sku ?? null,
        unit: product?.unit ?? "pz",
        quantity: toNumber(row.quantity_sales_unit),
        lot_code: lot?.lot_code ?? null,
        expiry_date: lot?.expiry_date ?? null,
        notes: null,
      };
    },
  );

  const data: DdtPdfData = {
    number: ddt.number,
    year: ddt.year,
    causale: ddt.causale as DdtCausale,
    issued_at: ddt.issued_at,
    supplier: supplierParty,
    recipient: recipientParty,
    lines: pdfLines,
    vettore: ddt.vettore,
    colli: ddt.colli,
    peso_kg: ddt.peso_kg != null ? Number(ddt.peso_kg) : null,
    notes: delivery.notes,
    template: template ?? null,
    copia: Boolean(options.copia),
  };

  // renderToBuffer's generic type signature has varied across @react-pdf/renderer
  // versions; cast to unknown first so we don't hard-couple to the current d.ts.
  const pdfBuffer = (await renderToBuffer(
    DdtPdfDocument(data),
  )) as unknown as Buffer;

  const suffix = options.pathSuffix ?? "";
  const path = `${ddt.supplier_id}/${ddt.year}/${ddt.number}${suffix}.pdf`;

  const { error: upErr } = await admin.storage
    .from(DDT_BUCKET)
    .upload(path, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (upErr) throw new Error(`ddt upload failed: ${upErr.message}`);

  const ttl = options.signedUrlTtlSeconds ?? SIGNED_URL_TTL_SECONDS;
  const { data: signed, error: signErr } = await admin.storage
    .from(DDT_BUCKET)
    .createSignedUrl(path, ttl);
  if (signErr || !signed?.signedUrl) {
    throw new Error(
      `ddt signed url failed: ${signErr?.message ?? "unknown error"}`,
    );
  }

  return { path, signedUrl: signed.signedUrl, size: pdfBuffer.byteLength };
}

function normalizeRecipient(raw: unknown): DdtParty {
  const fallback: DdtParty = { name: "Destinatario" };
  if (!raw || typeof raw !== "object") return fallback;
  const r = raw as Record<string, unknown>;
  const str = (k: string): string | null =>
    typeof r[k] === "string" && (r[k] as string).length > 0
      ? (r[k] as string)
      : null;
  return {
    name: str("name") ?? str("company_name") ?? "Destinatario",
    vat: str("vat") ?? str("vat_number") ?? str("piva"),
    fiscal_code: str("fiscal_code") ?? str("cf"),
    rea: str("rea") ?? str("rea_number"),
    address: str("address"),
    city: str("city"),
    postal_code: str("postal_code") ?? str("zip_code"),
    province: str("province"),
    country: str("country"),
    phone: str("phone"),
    email: str("email"),
  };
}
