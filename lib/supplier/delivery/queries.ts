/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createClient } from "@/lib/supabase/server";
import type { DeliveryStatus } from "@/types/database";

export type DeliverySlot = {
  label?: string | null;
  start?: string | null;
  end?: string | null;
} | null;

export type DeliveryRestaurant = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  zip_code: string | null;
  phone: string | null;
} | null;

export type DeliveryRow = {
  id: string;
  order_split_id: string;
  warehouse_id: string;
  driver_member_id: string | null;
  scheduled_date: string;
  scheduled_slot: DeliverySlot;
  status: DeliveryStatus;
  delivered_at: string | null;
  failure_reason: string | null;
  notes: string | null;
  order_split: {
    id: string;
    order_id: string;
    supplier_id: string;
    subtotal: number;
    delivery_zone_id: string | null;
    orders: {
      id: string;
      restaurants: DeliveryRestaurant;
    } | null;
  } | null;
  driver: {
    id: string;
    profile_id: string;
  } | null;
  zone_name: string | null;
};

export type ListDeliveriesParams = {
  supplierId: string;
  date: string; // ISO yyyy-mm-dd
  driverMemberId?: string | null; // when set, filter by driver
};

/**
 * Elenca le consegne per un giorno specifico filtrate per supplier,
 * eventualmente ristrette a un singolo driver (per ruolo `driver`
 * senza permesso `delivery.plan`).
 *
 * Join: deliveries → order_splits → orders → restaurants, driver member,
 * delivery_zone_name tramite mappa caricata in batch.
 */
export async function listDeliveriesForDate(
  params: ListDeliveriesParams,
): Promise<{ ok: true; data: DeliveryRow[] } | { ok: false; error: string }> {
  try {
    const { supplierId, date, driverMemberId } = params;
    if (!supplierId || !date) {
      return { ok: false, error: "Parametri non validi" };
    }
    const supabase = await createClient();

    type Raw = {
      id: string;
      order_split_id: string;
      warehouse_id: string;
      driver_member_id: string | null;
      scheduled_date: string;
      scheduled_slot: Record<string, unknown> | null;
      status: DeliveryStatus;
      delivered_at: string | null;
      failure_reason: string | null;
      notes: string | null;
      order_splits: {
        id: string;
        order_id: string;
        supplier_id: string;
        subtotal: number;
        delivery_zone_id: string | null;
        orders: {
          id: string;
          restaurants: {
            id: string;
            name: string;
            address: string | null;
            city: string | null;
            province: string | null;
            zip_code: string | null;
            phone: string | null;
          } | null;
        } | null;
      } | null;
      driver: { id: string; profile_id: string } | null;
    };

    let query = (supabase as any)
      .from("deliveries")
      .select(
        `id, order_split_id, warehouse_id, driver_member_id, scheduled_date,
         scheduled_slot, status, delivered_at, failure_reason, notes,
         order_splits:order_split_id (
           id, order_id, supplier_id, subtotal, delivery_zone_id,
           orders:order_id ( id, restaurants:restaurant_id ( id, name, address, city, province, zip_code, phone ) )
         ),
         driver:supplier_members!driver_member_id ( id, profile_id )`,
      )
      .eq("scheduled_date", date);

    if (driverMemberId) {
      query = query.eq("driver_member_id", driverMemberId);
    }

    const { data, error } = (await query) as {
      data: Raw[] | null;
      error: { message: string } | null;
    };

    if (error) return { ok: false, error: error.message };

    const filtered = (data ?? []).filter(
      (row) => row.order_splits?.supplier_id === supplierId,
    );

    // Carica in batch i nomi delle delivery_zones per le deliveries presenti.
    const zoneIds = Array.from(
      new Set(
        filtered
          .map((r) => r.order_splits?.delivery_zone_id)
          .filter((z): z is string => !!z),
      ),
    );
    const zoneMap = new Map<string, string>();
    if (zoneIds.length > 0) {
      const { data: zones } = (await supabase
        .from("delivery_zones")
        .select("id, zone_name")
        .in("id", zoneIds)
        .returns<Array<{ id: string; zone_name: string | null }>>()) as {
        data: Array<{ id: string; zone_name: string | null }> | null;
      };
      for (const z of zones ?? []) {
        if (z.zone_name) zoneMap.set(z.id, z.zone_name);
      }
    }

    const rows: DeliveryRow[] = filtered.map((r) => {
      const slotRaw = r.scheduled_slot ?? null;
      const slot: DeliverySlot = slotRaw
        ? {
            label: (slotRaw.label as string | undefined) ?? null,
            start: (slotRaw.start as string | undefined) ?? null,
            end: (slotRaw.end as string | undefined) ?? null,
          }
        : null;
      return {
        id: r.id,
        order_split_id: r.order_split_id,
        warehouse_id: r.warehouse_id,
        driver_member_id: r.driver_member_id,
        scheduled_date: r.scheduled_date,
        scheduled_slot: slot,
        status: r.status,
        delivered_at: r.delivered_at,
        failure_reason: r.failure_reason,
        notes: r.notes,
        order_split: r.order_splits
          ? {
              id: r.order_splits.id,
              order_id: r.order_splits.order_id,
              supplier_id: r.order_splits.supplier_id,
              subtotal: Number(r.order_splits.subtotal || 0),
              delivery_zone_id: r.order_splits.delivery_zone_id,
              orders: r.order_splits.orders
                ? {
                    id: r.order_splits.orders.id,
                    restaurants: r.order_splits.orders.restaurants,
                  }
                : null,
            }
          : null,
        driver: r.driver ?? null,
        zone_name: r.order_splits?.delivery_zone_id
          ? zoneMap.get(r.order_splits.delivery_zone_id) ?? null
          : null,
      };
    });

    // Ordina per slot start, poi per nome ristorante.
    rows.sort((a, b) => {
      const sa = a.scheduled_slot?.start ?? "";
      const sb = b.scheduled_slot?.start ?? "";
      if (sa !== sb) return sa < sb ? -1 : 1;
      const na = a.order_split?.orders?.restaurants?.name ?? "";
      const nb = b.order_split?.orders?.restaurants?.name ?? "";
      return na.localeCompare(nb);
    });

    return { ok: true, data: rows };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore caricamento consegne",
    };
  }
}

export type DriverOption = {
  id: string;
  profile_id: string;
  display_name: string;
};

/**
 * Elenca i driver attivi del supplier (membri con ruolo `driver`).
 * Usato per popolare il filtro `?driver=` nella vista admin.
 */
export async function listDriversForSupplier(
  supplierId: string,
): Promise<DriverOption[]> {
  if (!supplierId) return [];
  const supabase = await createClient();
  const { data } = (await supabase
    .from("supplier_members")
    .select("id, profile_id, role, is_active, accepted_at")
    .eq("supplier_id", supplierId)
    .eq("role", "driver")
    .eq("is_active", true)
    .not("accepted_at", "is", null)) as {
    data: Array<{ id: string; profile_id: string }> | null;
  };

  const members = data ?? [];
  if (members.length === 0) return [];

  const profileIds = members.map((m) => m.profile_id);
  const { data: profiles } = (await supabase
    .from("profiles")
    .select("id, company_name, email")
    .in("id", profileIds)) as {
    data: Array<{ id: string; company_name: string | null; email: string | null }> | null;
  };

  const profileMap = new Map<string, { name: string }>();
  for (const p of profiles ?? []) {
    profileMap.set(p.id, {
      name: p.company_name || p.email || "Driver",
    });
  }

  return members.map((m) => ({
    id: m.id,
    profile_id: m.profile_id,
    display_name: profileMap.get(m.profile_id)?.name ?? "Driver",
  }));
}

/**
 * Restituisce il supplier_member attivo (se esiste) per il profile corrente
 * e il supplier specificato. Utile al server page per capire il ruolo e,
 * se `driver`, filtrare le proprie consegne.
 */
export async function getActiveMember(
  supplierId: string,
): Promise<{ id: string; role: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = (await supabase
    .from("supplier_members")
    .select("id, role")
    .eq("supplier_id", supplierId)
    .eq("profile_id", user.id)
    .eq("is_active", true)
    .not("accepted_at", "is", null)
    .maybeSingle()) as { data: { id: string; role: string } | null };
  return data ?? null;
}
