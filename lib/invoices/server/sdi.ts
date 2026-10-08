// lib/invoices/server/sdi.ts
// Automatic reception of supplier invoices through the SDI intermediary:
// company registration (wizard), webhook event processing and the
// safety-net pull sync. All flows end in ingestDocuments() and then
// recompute the food cost and notify the team.

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { recomputeFoodCost } from "@/lib/food-cost/server/engine";
import { extractInvoiceDocuments } from "../archive.ts";
import { normalizeVat, parseFatturaElement, parseFatturaPA } from "../fatturapa.ts";
import { jsonToElement } from "../xml.ts";
import { activeProvider, getProvider } from "../providers/registry.ts";
import type { ProviderInvoiceDocument, SdiProvider } from "../providers/types.ts";
import { webhookAuthValue } from "../providers/openapi.ts";
import { rows, type Db } from "./db";
import { notifyAfterIngest } from "./notify";
import { ingestDocuments, type IngestDocument, type IngestReport, type IngestSource } from "./pipeline";

export interface SdiConnectionRow {
  id: string;
  restaurant_id: string;
  provider: string;
  status: "pending" | "active" | "error" | "disabled";
  fiscal_id: string;
  company_name: string | null;
  recipient_code: string | null;
  webhook_configured: boolean;
  registered_at: string | null;
  portal_confirmed_at: string | null;
  last_invoice_at: string | null;
  last_sync_at: string | null;
  last_error: string | null;
}

const CONNECTION_COLS =
  "id, restaurant_id, provider, status, fiscal_id, company_name, recipient_code, webhook_configured, registered_at, portal_confirmed_at, last_invoice_at, last_sync_at, last_error";

export function appUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? null;
  return raw ? raw.replace(/\/+$/, "") : null;
}

export function webhookUrlFor(provider: SdiProvider): string | null {
  const base = appUrl();
  return base ? `${base}/api/invoices/webhook/${provider.id}` : null;
}

export async function getConnection(db: Db, restaurantId: string): Promise<SdiConnectionRow | null> {
  const { data } = await db.from("sdi_connections").select(CONNECTION_COLS).eq("restaurant_id", restaurantId).maybeSingle();
  return (data as SdiConnectionRow | null) ?? null;
}

/** P.IVA + ragione sociale to prefill the wizard (owner's profile). */
export async function companyDefaults(restaurantId: string): Promise<{ fiscalId: string | null; companyName: string | null; email: string | null }> {
  const admin = createAdminClient() as Db;
  const { data: r } = await admin.from("restaurants").select("name, email, profile_id").eq("id", restaurantId).maybeSingle();
  if (!r) return { fiscalId: null, companyName: null, email: null };
  const { data: p } = await admin.from("profiles").select("company_name, vat_number").eq("id", r.profile_id).maybeSingle();
  return {
    fiscalId: normalizeVat(p?.vat_number ?? null),
    companyName: (p?.company_name as string | null) || (r.name as string | null),
    email: (r.email as string | null) ?? null,
  };
}

/** Register the company with the intermediary and store the connection. */
export async function registerRestaurant(
  db: Db,
  restaurantId: string,
  input: { fiscalId: string; companyName: string; email: string | null },
): Promise<{ ok: true; connection: SdiConnectionRow } | { ok: false; error: string }> {
  const provider = activeProvider();
  const st = provider.status();
  if (!st.configured) return { ok: false, error: "Ricezione automatica non ancora attiva su questa installazione" };
  const url = webhookUrlFor(provider);
  const auth = provider.id === "mock" ? "Bearer mock" : webhookAuthValue();
  if (!url || !auth) return { ok: false, error: "Configurazione webhook incompleta (NEXT_PUBLIC_APP_URL / INVOICES_WEBHOOK_SECRET)" };
  const fiscalId = normalizeVat(input.fiscalId);
  if (!fiscalId || !/^\d{11}$/.test(fiscalId)) return { ok: false, error: "Partita IVA non valida (11 cifre)" };

  // The same P.IVA can't be connected by two restaurants (invoices would be split).
  const admin = createAdminClient() as Db;
  const { data: other } = await admin.from("sdi_connections").select("restaurant_id").eq("fiscal_id", fiscalId).neq("restaurant_id", restaurantId).limit(1).maybeSingle();
  if (other) return { ok: false, error: "Questa Partita IVA è già collegata a un'altra sede: le fatture arrivano lì" };

  try {
    const res = await provider.registerCompany({
      fiscalId,
      companyName: input.companyName,
      email: input.email,
      webhookUrl: url,
      webhookAuthHeader: auth,
    });
    const { data, error } = await db
      .from("sdi_connections")
      .upsert(
        {
          restaurant_id: restaurantId,
          provider: provider.id,
          status: "pending",
          fiscal_id: fiscalId,
          company_name: input.companyName.slice(0, 300),
          recipient_code: res.recipientCode.slice(0, 7),
          provider_ref: res.providerRef,
          webhook_configured: res.webhookConfigured,
          registered_at: new Date().toISOString(),
          last_error: null,
        },
        { onConflict: "restaurant_id" },
      )
      .select(CONNECTION_COLS)
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Salvataggio non riuscito" };
    return { ok: true, connection: data as SdiConnectionRow };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Errore del servizio SDI";
    await db
      .from("sdi_connections")
      .upsert(
        { restaurant_id: restaurantId, provider: provider.id, status: "error", fiscal_id: fiscalId, company_name: input.companyName.slice(0, 300), last_error: msg.slice(0, 1000) },
        { onConflict: "restaurant_id" },
      );
    return { ok: false, error: msg };
  }
}

function toIngestDocuments(doc: ProviderInvoiceDocument): IngestDocument[] {
  if (doc.bytes) {
    const ex = extractInvoiceDocuments(doc.fileName, doc.bytes);
    return ex.documents.map((d) => ({ fileName: d.fileName, xml: d.xml, sourceKind: d.sourceKind }));
  }
  if (doc.json !== undefined && doc.json !== null) return [{ fileName: doc.fileName, json: doc.json, sourceKind: "json" }];
  return [];
}

/** Buyer P.IVA (cessionario) read from the document itself. */
function recipientFromDocument(doc: ProviderInvoiceDocument): string | null {
  for (const d of toIngestDocuments(doc)) {
    const parsed = d.xml ? parseFatturaPA(d.xml) : parseFatturaElement(jsonToElement("FatturaElettronica", d.json));
    const inv = parsed.invoices[0];
    const vat = normalizeVat(inv?.buyer.vatNumber ?? null) ?? normalizeVat(inv?.buyer.taxCode ?? null);
    if (vat) return vat;
  }
  return null;
}

async function ingestForConnection(conn: SdiConnectionRow, doc: ProviderInvoiceDocument, src: IngestSource): Promise<IngestReport> {
  const admin = createAdminClient() as Db;
  const docs = toIngestDocuments(doc);
  const report = await ingestDocuments(admin, conn.restaurant_id, docs, src);
  if (report.imported.length > 0) {
    await admin
      .from("sdi_connections")
      .update({ status: "active", last_invoice_at: new Date().toISOString(), last_error: null })
      .eq("id", conn.id);
    const alerts = await recomputeFoodCost(admin, conn.restaurant_id).catch(() => []);
    await notifyAfterIngest(conn.restaurant_id, report, alerts);
  }
  return report;
}

/** Process one stored inbound webhook event (idempotent). */
export async function processInboundEvent(eventId: string): Promise<void> {
  const admin = createAdminClient() as Db;
  const { data: ev } = await admin
    .from("sdi_inbound_events")
    .select("id, provider, event, external_id, payload, status, attempts")
    .eq("id", eventId)
    .maybeSingle();
  if (!ev || ev.status === "processed" || ev.status === "ignored") return;
  await admin.from("sdi_inbound_events").update({ attempts: Number(ev.attempts) + 1 }).eq("id", ev.id);
  const provider = getProvider(String(ev.provider));
  if (!provider) {
    await admin.from("sdi_inbound_events").update({ status: "ignored", error: "provider sconosciuto", processed_at: new Date().toISOString() }).eq("id", ev.id);
    return;
  }
  try {
    const parsed = provider.parseWebhook(ev.payload);
    if (parsed.kind !== "supplier_invoice" || !parsed.externalId) {
      await admin.from("sdi_inbound_events").update({ status: "ignored", processed_at: new Date().toISOString() }).eq("id", ev.id);
      return;
    }
    // Prefer the original file; fall back to the JSON carried by the callback.
    let doc: ProviderInvoiceDocument | null = null;
    try {
      doc = await provider.downloadInvoice({ externalId: parsed.externalId, receivedAt: null, recipientFiscalId: parsed.recipientFiscalId });
    } catch (err) {
      if (!parsed.document?.json) throw err;
      doc = parsed.document;
    }
    const fiscal = parsed.recipientFiscalId ?? doc.recipientFiscalId ?? recipientFromDocument(doc);
    const conns = fiscal
      ? await rows<SdiConnectionRow>(
          admin.from("sdi_connections").select(CONNECTION_COLS).eq("provider", provider.id).neq("status", "disabled").eq("fiscal_id", fiscal),
          "connections by fiscal id",
        )
      : [];
    if (conns.length === 0 || !doc) {
      await admin
        .from("sdi_inbound_events")
        .update({ status: "ignored", error: "Nessuna sede collegata a questa Partita IVA", processed_at: new Date().toISOString() })
        .eq("id", ev.id);
      return;
    }
    for (const conn of conns) {
      await ingestForConnection(conn, doc, { source: "sdi", provider: provider.id, externalId: parsed.externalId });
    }
    await admin
      .from("sdi_inbound_events")
      .update({ status: "processed", restaurant_id: conns[0]!.restaurant_id, error: null, processed_at: new Date().toISOString() })
      .eq("id", ev.id);
  } catch (err) {
    await admin
      .from("sdi_inbound_events")
      .update({ status: "error", error: (err instanceof Error ? err.message : "errore").slice(0, 2000) })
      .eq("id", ev.id);
  }
}

/** Pull invoices received since the last sync (safety net for missed webhooks). */
export async function syncConnection(conn: SdiConnectionRow): Promise<{ imported: number; error: string | null }> {
  const admin = createAdminClient() as Db;
  const provider = getProvider(conn.provider);
  if (!provider || !provider.status().configured) return { imported: 0, error: "provider non configurato" };
  const since = conn.last_sync_at
    ? new Date(Date.parse(conn.last_sync_at) - 2 * 86400 * 1000)
    : new Date(Date.now() - 30 * 86400 * 1000);
  const startedAt = new Date().toISOString();
  let imported = 0;
  try {
    const known = new Set(
      (
        await rows<{ sdi_identifier: string }>(
          admin.from("supplier_invoices").select("sdi_identifier").eq("restaurant_id", conn.restaurant_id).not("sdi_identifier", "is", null).gte("created_at", since.toISOString()),
          "known sdi ids",
        )
      ).map((r) => r.sdi_identifier),
    );
    for await (const ref of provider.listSupplierInvoices({ fiscalId: conn.fiscal_id, since })) {
      if (known.has(ref.externalId)) continue;
      const doc = await provider.downloadInvoice(ref);
      const rep = await ingestForConnection(conn, doc, { source: "provider_sync", provider: provider.id, externalId: ref.externalId });
      imported += rep.imported.length;
      known.add(ref.externalId);
    }
    await admin.from("sdi_connections").update({ last_sync_at: startedAt, last_error: null }).eq("id", conn.id);
    return { imported, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "errore di sincronizzazione";
    await admin.from("sdi_connections").update({ last_error: msg.slice(0, 1000), last_sync_at: startedAt }).eq("id", conn.id);
    return { imported, error: msg };
  }
}

export async function allSyncableConnections(): Promise<SdiConnectionRow[]> {
  const admin = createAdminClient() as Db;
  return rows<SdiConnectionRow>(admin.from("sdi_connections").select(CONNECTION_COLS).in("status", ["pending", "active", "error"]), "connections");
}
