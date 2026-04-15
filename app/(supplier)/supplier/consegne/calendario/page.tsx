import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DeliveryCalendar } from "@/components/supplier/delivery/delivery-calendar";
import { CalendarClient } from "./calendar-client";
import type { Database } from "@/types/database";

export const metadata: Metadata = {
  title: "Calendario consegne — Fornitore",
};

type ZoneRow = Database["public"]["Tables"]["delivery_zones"]["Row"];
type DeliveryRow = Database["public"]["Tables"]["deliveries"]["Row"];
type OrderSplitRow = Database["public"]["Tables"]["order_splits"]["Row"];

export type CalendarSlot = {
  from: string;
  to: string;
  label: string;
  capacity: number;
};

type PageProps = {
  searchParams: Promise<{ view?: string; start?: string }>;
};

function parseISODate(s: string | undefined): Date {
  if (s) {
    const d = new Date(s + "T00:00:00");
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeek(d: Date): Date {
  // Monday as first day
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = copy.getDay(); // 0=dom
  const diff = dow === 0 ? -6 : 1 - dow;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  c.setDate(c.getDate() + n);
  return c;
}

function extractSlots(raw: Record<string, unknown> | null): CalendarSlot[] {
  if (!raw) return [];
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { slots?: unknown }).slots)
      ? ((raw as { slots: unknown[] }).slots)
      : [];
  const out: CalendarSlot[] = [];
  for (const s of arr) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    const from = typeof o.from === "string" ? o.from : "";
    const to = typeof o.to === "string" ? o.to : "";
    if (!from || !to) continue;
    out.push({
      from,
      to,
      label:
        typeof o.label === "string" && o.label.trim()
          ? o.label
          : `${from}–${to}`,
      capacity:
        typeof o.capacity === "number" && Number.isFinite(o.capacity)
          ? Math.max(0, Math.trunc(o.capacity))
          : 0,
    });
  }
  return out;
}

function slotKey(s: { from: string; to: string }): string {
  return `${s.from}-${s.to}`;
}

export default async function DeliveryCalendarPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const view: "week" | "month" = sp.view === "month" ? "month" : "week";
  const anchor = parseISODate(sp.start);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("profile_id", user?.id ?? "")
    .maybeSingle<{ id: string }>();

  if (!supplier?.id) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-text-primary">
          Calendario consegne
        </h1>
        <div className="mt-6 rounded-xl border border-border-subtle bg-surface-card p-8 text-center text-text-secondary">
          Nessun profilo fornitore associato a questo utente.
        </div>
      </div>
    );
  }

  const rangeStart = view === "week" ? startOfWeek(anchor) : startOfMonth(anchor);
  const rangeEnd =
    view === "week"
      ? addDays(rangeStart, 7)
      : new Date(rangeStart.getFullYear(), rangeStart.getMonth() + 1, 1);

  const fromIso = toISODate(rangeStart);
  const toIso = toISODate(rangeEnd);

  // Zones (for slot definitions + capacity)
  const { data: zones } = await supabase
    .from("delivery_zones")
    .select("id, zone_name, delivery_slots")
    .eq("supplier_id", supplier.id)
    .returns<Pick<ZoneRow, "id" | "zone_name" | "delivery_slots">[]>();

  // Supplier splits → for delivery filter
  const { data: splits } = await supabase
    .from("order_splits")
    .select("id")
    .eq("supplier_id", supplier.id)
    .returns<Pick<OrderSplitRow, "id">[]>();

  const splitIds = (splits ?? []).map((s) => s.id);

  let deliveries: Pick<
    DeliveryRow,
    "id" | "scheduled_date" | "scheduled_slot" | "status"
  >[] = [];
  if (splitIds.length > 0) {
    const { data } = await supabase
      .from("deliveries")
      .select("id, scheduled_date, scheduled_slot, status")
      .in("order_split_id", splitIds)
      .gte("scheduled_date", fromIso)
      .lt("scheduled_date", toIso)
      .returns<
        Pick<DeliveryRow, "id" | "scheduled_date" | "scheduled_slot" | "status">[]
      >();
    deliveries = data ?? [];
  }

  // Union of all slots across zones
  const slotMap = new Map<string, CalendarSlot>();
  for (const z of zones ?? []) {
    for (const s of extractSlots(z.delivery_slots ?? null)) {
      const k = slotKey(s);
      const existing = slotMap.get(k);
      if (!existing) {
        slotMap.set(k, { ...s });
      } else {
        // Accumulate capacity when same slot appears in multiple zones
        slotMap.set(k, {
          ...existing,
          capacity: existing.capacity + s.capacity,
        });
      }
    }
  }
  const slots: CalendarSlot[] = Array.from(slotMap.values()).sort((a, b) =>
    a.from.localeCompare(b.from),
  );

  // Count deliveries per (date, slotKey)
  const usageByDateSlot = new Map<string, number>();
  const countsByDate = new Map<string, number>();
  for (const d of deliveries) {
    if (!d.scheduled_date) continue;
    countsByDate.set(
      d.scheduled_date,
      (countsByDate.get(d.scheduled_date) ?? 0) + 1,
    );
    const raw = d.scheduled_slot as Record<string, unknown> | null;
    if (raw && typeof raw === "object") {
      const from = typeof raw.from === "string" ? raw.from : "";
      const to = typeof raw.to === "string" ? raw.to : "";
      if (from && to) {
        const k = `${d.scheduled_date}|${from}-${to}`;
        usageByDateSlot.set(k, (usageByDateSlot.get(k) ?? 0) + 1);
      }
    }
  }

  const days: string[] = [];
  if (view === "week") {
    for (let i = 0; i < 7; i++) days.push(toISODate(addDays(rangeStart, i)));
  } else {
    const firstDow = rangeStart.getDay();
    const leadBlank = firstDow === 0 ? 6 : firstDow - 1;
    const gridStart = addDays(rangeStart, -leadBlank);
    for (let i = 0; i < 42; i++) days.push(toISODate(addDays(gridStart, i)));
  }

  // Prev / next navigation anchors
  const prevAnchor =
    view === "week" ? addDays(rangeStart, -7) : addDays(rangeStart, -1);
  const nextAnchor =
    view === "week"
      ? addDays(rangeStart, 7)
      : new Date(rangeStart.getFullYear(), rangeStart.getMonth() + 1, 1);

  const labelMonth = rangeStart.toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric",
  });
  const labelWeek = `${rangeStart.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
  })} – ${addDays(rangeStart, 6).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}`;

  const usage: Record<string, number> = {};
  usageByDateSlot.forEach((v, k) => {
    usage[k] = v;
  });
  const counts: Record<string, number> = {};
  countsByDate.forEach((v, k) => {
    counts[k] = v;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">
            Calendario consegne
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {view === "week" ? labelWeek : labelMonth.charAt(0).toUpperCase() + labelMonth.slice(1)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border-subtle bg-surface-card p-1">
            <Link
              href={`/supplier/consegne/calendario?view=week&start=${toISODate(startOfWeek(new Date()))}`}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                view === "week"
                  ? "bg-accent-green text-surface-base"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Settimana
            </Link>
            <Link
              href={`/supplier/consegne/calendario?view=month&start=${toISODate(startOfMonth(new Date()))}`}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                view === "month"
                  ? "bg-accent-green text-surface-base"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Mese
            </Link>
          </div>
          <CalendarClient
            view={view}
            prevHref={`/supplier/consegne/calendario?view=${view}&start=${toISODate(prevAnchor)}`}
            nextHref={`/supplier/consegne/calendario?view=${view}&start=${toISODate(nextAnchor)}`}
            todayHref={`/supplier/consegne/calendario?view=${view}&start=${toISODate(
              view === "week" ? startOfWeek(new Date()) : startOfMonth(new Date()),
            )}`}
          />
        </div>
      </div>

      <DeliveryCalendar
        view={view}
        days={days}
        slots={slots}
        usage={usage}
        counts={counts}
        rangeStart={toISODate(rangeStart)}
      />
    </div>
  );
}
