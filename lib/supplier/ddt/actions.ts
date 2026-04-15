/* eslint-disable @typescript-eslint/no-explicit-any */
// Task 8 (Plan 1D) — Server actions per generazione DDT.
//
// API esposte:
//   - generateDdtForDelivery(deliveryId)  → crea un nuovo DDT "sale"
//   - regenerateDdtPdf(ddtId)             → re-render PDF (stesso numero)
//   - generateCopyDdt(ddtId)              → ristampa COPIA (watermark, file aggiuntivo)
//   - cancelDdt(ddtId, reason)            → annulla e genera contro-DDT con causale `cancel`
//
// I DDT sono immutabili (vedi §7.3 spec): l'unico UPDATE ammesso è valorizzare
// canceled_at/canceled_reason sul documento originale; lo "storno" è un NUOVO
// ddt_documents riga con causale `cancel`. Per il progressivo si riusa
// `next_ddt_number` che prende un advisory xact lock per serializzare le
// emissioni sullo stesso (supplier, anno).
"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/supplier/context";

import { currentDdtYear, nextDdtNumber } from "./numbering";
import { DDT_BUCKET, renderDdtPdf } from "./render";

type Ok<T> = { ok: true } & T;
type Err = { ok: false; error: string };
type ActionResult<T> = Ok<T> | Err;

const SIGNED_URL_TTL = 60 * 60; // 1h

/**
 * Stati delivery considerati "caricati o oltre": dalla fase in cui la merce è
 * effettivamente assegnata al mezzo in poi, è lecito emettere il DDT.
 */
const DDT_ELIGIBLE_STATUSES = new Set([
  "loaded",
  "in_transit",
  "delivered",
]);

/** Costruisce un snapshot destinatario dal restaurant corrente. */
function buildRecipientSnapshot(r: {
  id: string;
  name: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  zip_code: string | null;
  phone: string | null;
  email: string | null;
}): Record<string, unknown> {
  return {
    restaurant_id: r.id,
    name: r.name ?? "Destinatario",
    address: r.address,
    city: r.city,
    province: r.province,
    postal_code: r.zip_code,
    phone: r.phone,
    email: r.email,
    country: "Italia",
    snapshot_at: new Date().toISOString(),
  };
}

type DeliveryContext = {
  id: string;
  status: string;
  supplier_id: string;
  order_split_id: string;
  restaurant: {
    id: string;
    name: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
    zip_code: string | null;
    phone: string | null;
    email: string | null;
  };
  default_template_id: string | null;
};

/** Carica delivery + supplier + restaurant in un colpo solo via admin client. */
async function loadDeliveryContext(
  deliveryId: string,
): Promise<DeliveryContext> {
  const admin = createAdminClient();
  const loose = admin as unknown as { from: (t: string) => any };

  const { data: deliveryRaw, error: delErr } = await loose
    .from("deliveries")
    .select(
      `id, status, order_split_id,
       order_splits:order_split_id (
         supplier_id,
         orders:order_id ( restaurant_id )
       )`,
    )
    .eq("id", deliveryId)
    .maybeSingle();
  if (delErr) throw new Error(`Errore caricamento consegna: ${delErr.message}`);
  if (!deliveryRaw) throw new Error("Consegna non trovata");

  const split = Array.isArray(deliveryRaw.order_splits)
    ? deliveryRaw.order_splits[0]
    : deliveryRaw.order_splits;
  if (!split) throw new Error("Order split non trovato per la consegna");
  const order = Array.isArray(split.orders) ? split.orders[0] : split.orders;
  if (!order) throw new Error("Ordine non trovato per la consegna");

  const supplierId: string = split.supplier_id;
  const restaurantId: string = order.restaurant_id;

  const { data: restaurantRaw, error: restErr } = await loose
    .from("restaurants")
    .select("id, name, address, city, province, zip_code, phone, email")
    .eq("id", restaurantId)
    .maybeSingle();
  if (restErr) throw new Error(`Errore caricamento ristorante: ${restErr.message}`);
  if (!restaurantRaw) throw new Error("Ristorante destinatario non trovato");

  const { data: supplierRaw } = await loose
    .from("suppliers")
    .select("default_ddt_template_id")
    .eq("id", supplierId)
    .maybeSingle();

  return {
    id: deliveryRaw.id,
    status: deliveryRaw.status,
    supplier_id: supplierId,
    order_split_id: deliveryRaw.order_split_id,
    restaurant: restaurantRaw,
    default_template_id: supplierRaw?.default_ddt_template_id ?? null,
  };
}

/** Verifica se esiste già un DDT attivo (non annullato) per la delivery. */
async function existingDdtForDelivery(
  deliveryId: string,
): Promise<{ id: string; number: number; year: number } | null> {
  const admin = createAdminClient();
  const loose = admin as unknown as { from: (t: string) => any };
  const { data } = await loose
    .from("ddt_documents")
    .select("id, number, year, causale, canceled_at")
    .eq("delivery_id", deliveryId)
    .neq("causale", "cancel")
    .is("canceled_at", null)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, number: data.number, year: data.year };
}

/**
 * Genera il DDT di vendita per una consegna caricata.
 *
 * Precondizioni:
 *   - status delivery ∈ {loaded, in_transit, delivered}
 *   - non esiste già un DDT attivo sulla stessa delivery
 *   - caller ha permesso `ddt.generate`
 */
export async function generateDdtForDelivery(
  deliveryId: string,
): Promise<
  ActionResult<{
    ddtId: string;
    number: number;
    year: number;
    pdfUrl: string;
  }>
> {
  try {
    if (!deliveryId || typeof deliveryId !== "string") {
      return { ok: false, error: "ID consegna non valido" };
    }

    const ctx = await loadDeliveryContext(deliveryId);
    await requirePermission(ctx.supplier_id, "ddt.generate");

    if (!DDT_ELIGIBLE_STATUSES.has(ctx.status)) {
      return {
        ok: false,
        error:
          "Il DDT può essere emesso solo a partire dallo stato 'caricato'.",
      };
    }

    const existing = await existingDdtForDelivery(deliveryId);
    if (existing) {
      return {
        ok: false,
        error: `DDT già emesso per questa consegna (n. ${existing.number}/${existing.year}).`,
      };
    }

    // Allocazione numero + INSERT devono vivere nello stesso ciclo richiesta:
    // il lock è xact ma qui lavoriamo via PostgREST (connessioni separate),
    // per cui ci affidiamo al vincolo UNIQUE(supplier,year,number) come
    // secondo livello di difesa in caso di race su generator concorrenti.
    const supabase = await createClient();
    const year = currentDdtYear();
    const number = await nextDdtNumber(supabase, ctx.supplier_id, year);

    const recipientSnapshot = buildRecipientSnapshot(ctx.restaurant);

    const admin = createAdminClient();
    const loose = admin as unknown as { from: (t: string) => any };

    // 1) INSERT con pdf_url placeholder (pdf_url è NOT NULL in schema).
    const placeholderPath = `${ctx.supplier_id}/${year}/${number}.pdf`;
    const { data: inserted, error: insErr } = await loose
      .from("ddt_documents")
      .insert({
        supplier_id: ctx.supplier_id,
        delivery_id: deliveryId,
        number,
        year,
        causale: "sale",
        recipient_snapshot: recipientSnapshot,
        pdf_url: placeholderPath,
        template_id: ctx.default_template_id,
      })
      .select("id")
      .single();
    if (insErr || !inserted) {
      return {
        ok: false,
        error: insErr?.message ?? "Errore creazione DDT",
      };
    }

    // 2) Render PDF + upload (riusa il path canonico).
    const rendered = await renderDdtPdf(inserted.id, {
      signedUrlTtlSeconds: SIGNED_URL_TTL,
    });

    // 3) Aggiorna pdf_url al path canonico (allinea a quanto effettivamente
    //    caricato). Nota: questo è un UPDATE "di completamento" subito dopo
    //    l'INSERT, non una mutazione post-emissione.
    if (rendered.path !== placeholderPath) {
      await loose
        .from("ddt_documents")
        .update({ pdf_url: rendered.path })
        .eq("id", inserted.id);
    }

    revalidatePath("/supplier/ddt");
    revalidatePath("/supplier/consegne");
    revalidatePath(`/supplier/consegne/${deliveryId}`);

    return {
      ok: true,
      ddtId: inserted.id,
      number,
      year,
      pdfUrl: rendered.signedUrl,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore generazione DDT",
    };
  }
}

/**
 * Re-render del PDF mantenendo lo stesso numero (utile se il template
 * aziendale è cambiato). Non modifica `ddt_documents` se non eventualmente
 * il `pdf_url` per riallinearlo al path canonico.
 */
export async function regenerateDdtPdf(
  ddtId: string,
): Promise<ActionResult<{ pdfUrl: string }>> {
  try {
    if (!ddtId || typeof ddtId !== "string") {
      return { ok: false, error: "ID DDT non valido" };
    }

    const admin = createAdminClient();
    const loose = admin as unknown as { from: (t: string) => any };
    const { data: row, error } = await loose
      .from("ddt_documents")
      .select("id, supplier_id, canceled_at")
      .eq("id", ddtId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!row) return { ok: false, error: "DDT non trovato" };
    if (row.canceled_at) {
      return { ok: false, error: "Impossibile rigenerare un DDT annullato" };
    }

    await requirePermission(row.supplier_id, "ddt.generate");

    const rendered = await renderDdtPdf(ddtId, {
      signedUrlTtlSeconds: SIGNED_URL_TTL,
    });

    await loose
      .from("ddt_documents")
      .update({ pdf_url: rendered.path })
      .eq("id", ddtId);

    revalidatePath("/supplier/ddt");
    revalidatePath(`/supplier/ddt/${ddtId}`);

    return { ok: true, pdfUrl: rendered.signedUrl };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore rigenerazione PDF",
    };
  }
}

/**
 * Ristampa COPIA: renderizza il PDF con watermark "COPIA", lo carica con un
 * path diverso (`<supplier>/<year>/<number>-copy-<ts>.pdf`) per non toccare
 * l'originale immutabile, e restituisce un URL firmato temporaneo.
 * Non modifica `ddt_documents`.
 */
export async function generateCopyDdt(
  ddtId: string,
): Promise<ActionResult<{ pdfUrl: string }>> {
  try {
    if (!ddtId || typeof ddtId !== "string") {
      return { ok: false, error: "ID DDT non valido" };
    }

    const admin = createAdminClient();
    const loose = admin as unknown as { from: (t: string) => any };
    const { data: row, error } = await loose
      .from("ddt_documents")
      .select("id, supplier_id")
      .eq("id", ddtId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!row) return { ok: false, error: "DDT non trovato" };

    await requirePermission(row.supplier_id, "ddt.generate");

    const rendered = await renderDdtPdf(ddtId, {
      copia: true,
      pathSuffix: `-copy-${Date.now()}`,
      signedUrlTtlSeconds: SIGNED_URL_TTL,
    });

    return { ok: true, pdfUrl: rendered.signedUrl };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore ristampa COPIA",
    };
  }
}

/**
 * Annulla un DDT:
 *   - valorizza `canceled_at` / `canceled_reason` sul documento originale
 *     (unico UPDATE ammesso dallo spec §7.3);
 *   - emette un DDT di storno con causale `cancel`, nuovo numero, stessa
 *     delivery e `recipient_snapshot` identico all'originale.
 */
export async function cancelDdt(
  ddtId: string,
  reason: string,
): Promise<
  ActionResult<{ cancelDdtId: string; cancelNumber: number; cancelYear: number }>
> {
  try {
    if (!ddtId || typeof ddtId !== "string") {
      return { ok: false, error: "ID DDT non valido" };
    }
    const trimmed = (reason ?? "").trim();
    if (trimmed.length < 3) {
      return {
        ok: false,
        error: "Motivo annullamento obbligatorio (min. 3 caratteri)",
      };
    }

    const admin = createAdminClient();
    const loose = admin as unknown as { from: (t: string) => any };

    const { data: original, error: origErr } = await loose
      .from("ddt_documents")
      .select(
        "id, supplier_id, delivery_id, recipient_snapshot, template_id, canceled_at, causale",
      )
      .eq("id", ddtId)
      .maybeSingle();
    if (origErr) return { ok: false, error: origErr.message };
    if (!original) return { ok: false, error: "DDT non trovato" };
    if (original.canceled_at) {
      return { ok: false, error: "DDT già annullato" };
    }
    if (original.causale === "cancel") {
      return { ok: false, error: "Un DDT di storno non può essere annullato" };
    }

    await requirePermission(original.supplier_id, "ddt.generate");

    // 1) Marca l'originale come annullato (unico UPDATE ammesso).
    const { error: updErr } = await loose
      .from("ddt_documents")
      .update({
        canceled_at: new Date().toISOString(),
        canceled_reason: trimmed,
      })
      .eq("id", ddtId);
    if (updErr) return { ok: false, error: updErr.message };

    // 2) Emette il DDT di storno (causale `cancel`) con nuovo progressivo.
    const supabase = await createClient();
    const year = currentDdtYear();
    const number = await nextDdtNumber(supabase, original.supplier_id, year);
    const stornoPath = `${original.supplier_id}/${year}/${number}.pdf`;

    const { data: stornoRow, error: stornoErr } = await loose
      .from("ddt_documents")
      .insert({
        supplier_id: original.supplier_id,
        delivery_id: original.delivery_id,
        number,
        year,
        causale: "cancel",
        recipient_snapshot: original.recipient_snapshot,
        pdf_url: stornoPath,
        template_id: original.template_id,
      })
      .select("id")
      .single();
    if (stornoErr || !stornoRow) {
      return {
        ok: false,
        error: stornoErr?.message ?? "Errore emissione DDT di storno",
      };
    }

    // 3) Render PDF dello storno.
    try {
      const rendered = await renderDdtPdf(stornoRow.id, {
        signedUrlTtlSeconds: SIGNED_URL_TTL,
      });
      if (rendered.path !== stornoPath) {
        await loose
          .from("ddt_documents")
          .update({ pdf_url: rendered.path })
          .eq("id", stornoRow.id);
      }
    } catch (renderErr) {
      // Il documento di storno è già persistito: logghiamo ma non rollback.
      console.error("[cancelDdt] storno render failed", renderErr);
    }

    revalidatePath("/supplier/ddt");
    revalidatePath(`/supplier/ddt/${ddtId}`);

    return {
      ok: true,
      cancelDdtId: stornoRow.id,
      cancelNumber: number,
      cancelYear: year,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore annullamento DDT",
    };
  }
}

// Re-export helpers utili ai chiamanti (storage bucket/name).
export { DDT_BUCKET };
