/* eslint-disable @typescript-eslint/no-explicit-any */
// Loaders for "order to any supplier, any channel" (off-platform suppliers).

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseCatalogOrderBlocks, parseQty, shortOrderId } from "@/lib/orders/catalog-pdf";
import { buildOrderText, normalizeWhatsAppPhone, splitNameUnit, type OrderChannel } from "./text";

export type CatalogContact = {
  catalogId: string;
  preferredChannel: OrderChannel;
  contactName: string | null;
  whatsappPhone: string | null;
  email: string | null;
  notes: string | null;
};

export type DispatchRecord = {
  channel: OrderChannel;
  status: "sent" | "confirmed";
  recipient: string | null;
  sentAt: string;
  confirmedAt: string | null;
};

export type DispatchBlock = {
  index: number;
  supplierLabel: string;
  catalogId: string | null;
  contact: CatalogContact | null;
  /** Ready-to-send Italian text (WhatsApp / copy). */
  text: string;
  dispatches: DispatchRecord[];
};

function rowToContact(r: any): CatalogContact {
  return {
    catalogId: r.catalog_id,
    preferredChannel: (r.preferred_channel ?? "whatsapp") as OrderChannel,
    contactName: r.contact_name ?? null,
    whatsappPhone: r.whatsapp_phone ?? null,
    email: r.email ?? null,
    notes: r.notes ?? null,
  };
}

/** Contacts of private catalogs (empty map when the table is missing). */
export async function loadCatalogContacts(catalogIds: string[]): Promise<Map<string, CatalogContact>> {
  const out = new Map<string, CatalogContact>();
  if (catalogIds.length === 0) return out;
  const supabase = (await createClient()) as any;
  const { data, error } = await supabase
    .from("restaurant_catalog_contacts")
    .select("catalog_id, preferred_channel, contact_name, whatsapp_phone, email, notes")
    .in("catalog_id", catalogIds);
  if (error) return out;
  for (const r of data ?? []) out.set(r.catalog_id, rowToContact(r));
  return out;
}

/** Catalog id of a supplier block, matched by name within the restaurant's catalogs. */
export async function catalogIdsByName(restaurantId: string): Promise<Map<string, string>> {
  const supabase = (await createClient()) as any;
  const { data } = await supabase.from("restaurant_catalogs").select("id, supplier_name").eq("restaurant_id", restaurantId);
  const out = new Map<string, string>();
  for (const c of (data ?? []) as { id: string; supplier_name: string }[]) {
    out.set(c.supplier_name.trim().toLowerCase(), c.id);
  }
  return out;
}

/** Dispatch panel data for a private-catalog order (null for marketplace orders). */
export async function loadOrderDispatch(order: {
  id: string;
  restaurant_id: string;
  notes: string | null;
}): Promise<DispatchBlock[] | null> {
  if (!order.notes) return null;
  const blocks = parseCatalogOrderBlocks(order.notes);
  if (blocks.length === 0) return null;
  const supabase = (await createClient()) as any;

  const [byName, restRes, dispRes] = await Promise.all([
    catalogIdsByName(order.restaurant_id),
    supabase.from("restaurants").select("name, address, city, phone").eq("id", order.restaurant_id).maybeSingle(),
    supabase
      .from("order_dispatches")
      .select("block_index, channel, status, recipient, sent_at, confirmed_at")
      .eq("order_id", order.id)
      .order("sent_at", { ascending: false }),
  ]);
  const catalogIds = blocks
    .map((b) => byName.get(b.supplierName.trim().toLowerCase()))
    .filter((x): x is string => !!x);
  const contacts = await loadCatalogContacts(catalogIds);
  const rest = restRes.data as { name: string; address: string | null; city: string | null; phone: string | null } | null;
  const dispatches = (dispRes.error ? [] : (dispRes.data ?? [])) as {
    block_index: number;
    channel: OrderChannel;
    status: "sent" | "confirmed";
    recipient: string | null;
    sent_at: string;
    confirmed_at: string | null;
  }[];

  return blocks.map((b, index) => {
    const catalogId = byName.get(b.supplierName.trim().toLowerCase()) ?? null;
    const contact = catalogId ? contacts.get(catalogId) ?? null : null;
    const text = buildOrderText({
      restaurantName: rest?.name ?? "Ristorante",
      restaurantAddress: [rest?.address, rest?.city].filter(Boolean).join(", ") || null,
      restaurantPhone: rest?.phone ?? null,
      supplierLabel: b.supplierName,
      contactName: contact?.contactName ?? null,
      orderShortId: shortOrderId(order.id),
      lines: b.items.map((it) => {
        const { name, unit } = splitNameUnit(it.name);
        return { qty: parseQty(it.qty), name, unit };
      }),
    });
    return {
      index,
      supplierLabel: b.supplierName,
      catalogId,
      contact: contact
        ? { ...contact, whatsappPhone: normalizeWhatsAppPhone(contact.whatsappPhone) ?? contact.whatsappPhone }
        : null,
      text,
      dispatches: dispatches
        .filter((d) => d.block_index === index)
        .map((d) => ({
          channel: d.channel,
          status: d.status,
          recipient: d.recipient,
          sentAt: d.sent_at,
          confirmedAt: d.confirmed_at,
        })),
    };
  });
}
