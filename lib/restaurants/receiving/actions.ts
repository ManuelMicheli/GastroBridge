/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

// Goods receiving check-in ("Ricevi merce"): per-line outcome with photos,
// stored in delivery_checks / delivery_check_lines, and an automatic message to
// the supplier (order thread of the partnership chat) when something is wrong.

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { accessCan, getRestaurantAccess, requireRestaurantContext } from "@/lib/restaurants/context";
import { resolveRelationshipIdForPair } from "@/lib/messages/context";
import { notifyRestaurantTeam } from "@/lib/notifications/restaurant";
import { ISSUE_LABELS, type DeliveryIssue } from "./types";
import { HACCP_CATEGORIES, ruleLabel, temperatureOk, temperatureRule, toMacroCategory } from "./haccp";
import { loadHaccpSettings } from "./server";

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

const DELIVERY_PHOTO_BUCKET = "delivery-checks";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // chat attachments stay readable for a year

type OrderRow = { id: string; restaurant_id: string; status: string; notes: string | null };

async function authorizeOrder(orderId: string): Promise<
  { ok: true; order: OrderRow; userId: string } | { ok: false; error: string }
> {
  if (!z.string().uuid().safeParse(orderId).success) return { ok: false, error: "Ordine non valido" };
  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessione scaduta, effettua di nuovo l'accesso" };
  const { data: order } = (await supabase
    .from("orders")
    .select("id, restaurant_id, status, notes")
    .eq("id", orderId)
    .maybeSingle()) as { data: OrderRow | null };
  if (!order) return { ok: false, error: "Ordine non trovato" };
  const access = await getRestaurantAccess(order.restaurant_id);
  if (!access) return { ok: false, error: "Ordine non trovato" };
  if (!accessCan(access, "order.receive")) {
    return { ok: false, error: "Il tuo ruolo non consente di registrare il ricevimento merce" };
  }
  return { ok: true, order, userId: user.id };
}

/** Upload one (client-compressed) photo; returns its storage path. */
export async function uploadDeliveryPhoto(formData: FormData): Promise<Result<{ path: string }>> {
  const orderId = String(formData.get("orderId") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Foto mancante" };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, error: "Foto troppo grande (max 5 MB)" };
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) return { ok: false, error: "Formato foto non supportato" };

  const auth = await authorizeOrder(orderId);
  if (!auth.ok) return auth;
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${auth.order.restaurant_id}/${orderId}/${randomUUID()}.${ext}`;
  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(DELIVERY_PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    return {
      ok: false,
      error: /bucket not found/i.test(error.message)
        ? "Archivio foto non ancora attivo: applica le migrazioni del database."
        : `Caricamento foto non riuscito: ${error.message}`,
    };
  }
  return { ok: true, data: { path } };
}

const lineSchema = z.object({
  ref: z.string().min(1).max(120),
  name: z.string().trim().min(1).max(300),
  unit: z.string().trim().max(30).nullable(),
  orderedQty: z.number().nonnegative().nullable(),
  receivedQty: z.number().nonnegative().nullable(),
  issue: z.enum(["ok", "missing", "short", "damaged", "wrong_item", "quality"]),
  note: z.string().trim().max(500).nullable(),
  photoPaths: z.array(z.string().max(300)).max(6),
  // HACCP traceability
  category: z.string().max(30).nullable(),
  lotNumber: z.string().trim().max(80).nullable(),
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Scadenza non valida")
    .nullable(),
  temperatureC: z.number().min(-40).max(40).nullable(),
});

const blockSchema = z.object({
  /** order_splits.id for marketplace blocks, null for private-catalog blocks. */
  splitId: z.string().uuid().nullable(),
  supplierLabel: z.string().trim().min(1).max(200),
  ddtNumber: z.string().trim().max(60).nullable(),
  ddtPhotoPath: z.string().max(300).nullable(),
  lines: z.array(lineSchema).min(1).max(300),
});

const checkSchema = z.object({
  orderId: z.string().uuid(),
  notes: z.string().trim().max(1000).nullable(),
  blocks: z.array(blockSchema).min(1).max(30),
});

export type SubmitDeliveryCheckInput = z.infer<typeof checkSchema>;

function fmtQty(q: number | null): string {
  return q === null ? "—" : new Intl.NumberFormat("it-IT", { maximumFractionDigits: 3 }).format(q);
}

export async function submitDeliveryCheck(
  input: SubmitDeliveryCheckInput,
): Promise<Result<{ checks: number; issues: number; messagesSent: number }>> {
  const parsed = checkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  const d = parsed.data;
  const auth = await authorizeOrder(d.orderId);
  if (!auth.ok) return auth;
  const { order, userId } = auth;
  if (order.status === "cancelled") return { ok: false, error: "Ordine annullato" };

  const supabase = (await createClient()) as any;
  const photoPrefix = `${order.restaurant_id}/${order.id}/`;
  const badPath = (p: string) => !p.startsWith(photoPrefix) || p.includes("..");
  for (const b of d.blocks) {
    if (b.ddtPhotoPath && badPath(b.ddtPhotoPath)) return { ok: false, error: "Foto DDT non valida" };
    for (const l of b.lines) {
      if (l.photoPaths.some(badPath)) return { ok: false, error: "Foto non valida" };
    }
  }
  const haccp = await loadHaccpSettings(order.restaurant_id);
  if (haccp.requireDdtPhoto && d.blocks.some((b) => !b.ddtPhotoPath)) {
    return { ok: false, error: "Scatta la foto del DDT per ogni fornitore" };
  }

  // Splits must belong to this order.
  const { data: splitRows } = (await supabase
    .from("order_splits")
    .select("id, supplier_id")
    .eq("order_id", order.id)) as { data: { id: string; supplier_id: string }[] | null };
  const splitSupplier = new Map((splitRows ?? []).map((s) => [s.id, s.supplier_id]));
  for (const b of d.blocks) {
    if (b.splitId && !splitSupplier.has(b.splitId)) return { ok: false, error: "Fornitore non valido per questo ordine" };
  }

  let totalIssues = 0;
  let messagesSent = 0;
  const shortId = order.id.slice(0, 8);

  const tempBad = (l: (typeof d.blocks)[number]["lines"][number]) =>
    temperatureOk(toMacroCategory(l.category, l.name), l.temperatureC, haccp) === false;

  for (const b of d.blocks) {
    // A temperature outside the configured range is a non-conformity too.
    const issues = b.lines.filter((l) => l.issue !== "ok" || tempBad(l));
    totalIssues += issues.length;
    const supplierId = b.splitId ? splitSupplier.get(b.splitId)! : null;

    const { data: check, error: checkErr } = await supabase
      .from("delivery_checks")
      .insert({
        restaurant_id: order.restaurant_id,
        order_id: order.id,
        order_split_id: b.splitId,
        supplier_id: supplierId,
        supplier_label: b.supplierLabel,
        outcome: issues.length > 0 ? "issues" : "ok",
        issue_count: issues.length,
        notes: d.notes || null,
        ddt_number: b.ddtNumber || null,
        ddt_photo_path: b.ddtPhotoPath,
        checked_by: userId,
      })
      .select("id")
      .single();
    if (checkErr || !check) {
      const msg = checkErr?.message ?? "";
      return {
        ok: false,
        error:
          checkErr?.code === "42P01" || /does not exist|schema cache/i.test(msg)
            ? "Funzione non ancora attiva: applica le migrazioni del database (restaurant superpowers)."
            : msg || "Errore salvataggio ricevimento",
      };
    }

    const { error: linesErr } = await supabase.from("delivery_check_lines").insert(
      b.lines.map((l) => {
        const category = toMacroCategory(l.category, l.name);
        return {
          check_id: check.id,
          restaurant_id: order.restaurant_id,
          line_ref: l.ref,
          product_name: l.name,
          unit: l.unit,
          ordered_qty: l.orderedQty,
          received_qty: l.issue === "missing" ? 0 : l.receivedQty,
          issue: l.issue,
          note: l.note || null,
          photo_paths: l.photoPaths,
          category,
          lot_number: l.lotNumber || null,
          expiry_date: l.expiryDate,
          temperature_c: l.temperatureC,
          // Recomputed server-side from the restaurant's own rules.
          temperature_ok: temperatureOk(category, l.temperatureC, haccp),
        };
      }),
    );
    if (linesErr) return { ok: false, error: linesErr.message };

    // Dispute message to the supplier (platform suppliers only).
    if (issues.length > 0 && supplierId) {
      const relId = await resolveRelationshipIdForPair(order.restaurant_id, supplierId);
      if (relId) {
        const body = [
          `Ricevimento merce — ordine #${shortId}`,
          `Problemi su ${issues.length} rig${issues.length === 1 ? "a" : "he"}:`,
          ...issues.map((l) => {
            const parts: string[] = [];
            if (l.issue !== "ok") {
              const qty =
                l.issue === "missing" || l.issue === "short"
                  ? ` (ordinati ${fmtQty(l.orderedQty)}, ricevuti ${fmtQty(l.issue === "missing" ? 0 : l.receivedQty)}${l.unit ? ` ${l.unit}` : ""})`
                  : "";
              parts.push(`${ISSUE_LABELS[l.issue as DeliveryIssue].toLowerCase()}${qty}`);
            }
            if (tempBad(l)) {
              const rule = temperatureRule(toMacroCategory(l.category, l.name), haccp);
              parts.push(`temperatura ${fmtQty(l.temperatureC)} °C fuori range (${ruleLabel(rule)})`);
            }
            const lot = l.lotNumber ? ` [lotto ${l.lotNumber}]` : "";
            return `• ${l.name}${lot}: ${parts.join(", ")}${l.note ? ` — ${l.note}` : ""}`;
          }),
          b.ddtNumber ? `DDT n. ${b.ddtNumber}` : null,
          d.notes ? `Note: ${d.notes}` : null,
          "Chiediamo nota di credito o reintegro alla prossima consegna.",
        ]
          .filter(Boolean)
          .join("\n")
          .slice(0, 2000);

        const attachments: { name: string; url: string; mime: string }[] = [];
        for (const l of issues) {
          for (const p of l.photoPaths) {
            const { data: signed } = await supabase.storage.from(DELIVERY_PHOTO_BUCKET).createSignedUrl(p, SIGNED_URL_TTL);
            if (signed?.signedUrl) {
              attachments.push({ name: `${l.name} — foto`.slice(0, 200), url: signed.signedUrl, mime: "image/jpeg" });
            }
          }
        }

        const message = {
          relationship_id: relId,
          sender_role: "restaurant",
          sender_profile: userId,
          body,
          attachments: attachments.length > 0 ? attachments.slice(0, 10) : null,
          order_split_id: b.splitId,
        };
        // The user may lack partnership.manage; order.receive was checked
        // above, so fall back to the service role for this single insert.
        let { error: msgErr } = await supabase.from("partnership_messages").insert(message);
        if (msgErr) {
          try {
            ({ error: msgErr } = await (createAdminClient() as any).from("partnership_messages").insert(message));
          } catch {
            /* service key missing */
          }
        }
        if (!msgErr) {
          messagesSent += 1;
          await supabase.from("delivery_checks").update({ message_sent: true }).eq("id", check.id);
        }
      }
    }
  }

  // Private-catalog orders have no supplier workflow: the restaurant closes them.
  // Marketplace splits stay with the supplier (delivered requires POD / DDT).
  if (splitSupplier.size === 0 && order.status !== "delivered") {
    try {
      await (createAdminClient() as any).from("orders").update({ status: "delivered" }).eq("id", order.id);
    } catch {
      /* best effort */
    }
  }

  if (totalIssues > 0) {
    await notifyRestaurantTeam(
      order.restaurant_id,
      "issue.resolve",
      {
        event: "delivery_issue",
        title: "Problemi alla consegna",
        body: `${totalIssues} rig${totalIssues === 1 ? "a" : "he"} con problemi nell'ordine #${shortId}${
          messagesSent > 0 ? " — fornitore avvisato in chat" : ""
        }`,
        link: `/ordini/${order.id}`,
        metadata: { orderId: order.id },
        tag: `delivery_issue:${order.id}`,
      },
      { excludeProfileIds: [userId] },
    );
  }

  revalidatePath(`/ordini/${order.id}`);
  revalidatePath("/ordini");
  revalidatePath("/dashboard");
  revalidatePath("/messaggi");
  revalidatePath("/tracciabilita");
  return { ok: true, data: { checks: d.blocks.length, issues: totalIssues, messagesSent } };
}

/* ------------------------------------------------------------------ */
/* HACCP settings                                                       */
/* ------------------------------------------------------------------ */

const ruleSchema = z.object({
  min: z.number().min(-40).max(40).nullable(),
  max: z.number().min(-40).max(40).nullable(),
});

const haccpSchema = z.object({
  tracedCategories: z.array(z.string().max(30)).max(10),
  tracedKeywords: z.array(z.string().trim().min(2).max(40)).max(30),
  temperatureRules: z.record(z.string(), ruleSchema),
  requireDdtPhoto: z.boolean(),
});

export async function saveHaccpSettings(input: z.infer<typeof haccpSchema>): Promise<Result> {
  const parsed = haccpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  const auth = await requireRestaurantContext("settings.manage");
  if (!auth.ok) return auth;
  const d = parsed.data;
  const known = HACCP_CATEGORIES as string[];
  const rules: Record<string, { min?: number; max?: number }> = {};
  for (const [cat, r] of Object.entries(d.temperatureRules)) {
    if (!known.includes(cat)) continue;
    if (r.min === null && r.max === null) continue;
    if (r.min !== null && r.max !== null && r.min > r.max) {
      return { ok: false, error: "Temperatura minima maggiore della massima" };
    }
    rules[cat] = { ...(r.min !== null ? { min: r.min } : {}), ...(r.max !== null ? { max: r.max } : {}) };
  }
  const supabase = (await createClient()) as any;
  const { error } = await supabase.from("restaurant_haccp_settings").upsert(
    {
      restaurant_id: auth.ctx.restaurantId,
      traced_categories: [...new Set(d.tracedCategories.filter((c) => known.includes(c)))],
      traced_keywords: [...new Set(d.tracedKeywords.map((k) => k.toLowerCase()))],
      temperature_rules: rules,
      require_ddt_photo: d.requireDdtPhoto,
      updated_by: auth.ctx.userId,
    },
    { onConflict: "restaurant_id" },
  );
  if (error) {
    return {
      ok: false,
      error:
        error.code === "42P01" || /does not exist|schema cache/i.test(error.message ?? "")
          ? "Funzione non ancora attiva: applica le migrazioni del database (restaurant superpowers)."
          : error.message,
    };
  }
  revalidatePath("/tracciabilita");
  return { ok: true, data: undefined };
}
