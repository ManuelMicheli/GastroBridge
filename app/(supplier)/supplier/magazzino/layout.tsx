import type { ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  WarehouseSwitcher,
  type WarehouseOption,
} from "@/components/supplier/shared/warehouse-switcher";
import type { Database } from "@/types/database";

type WarehouseRow = Database["public"]["Tables"]["warehouses"]["Row"];

const SUBNAV: { href: string; label: string }[] = [
  { href: "/supplier/magazzino", label: "Giacenze" },
  { href: "/supplier/magazzino/lotti", label: "Lotti" },
  { href: "/supplier/magazzino/carichi", label: "Carichi" },
  { href: "/supplier/magazzino/inventario", label: "Inventario" },
  { href: "/supplier/magazzino/movimenti", label: "Movimenti" },
];

/**
 * Layout condiviso per le pagine `/supplier/magazzino/*`.
 * Server component: carica i warehouses del fornitore corrente e monta il
 * WarehouseSwitcher + sotto-nav orizzontale. Il tab attivo è evidenziato
 * con `accent-green` lato client dalla pagina (qui rendiamo solo i link).
 */
export default async function SupplierMagazzinoLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let warehouses: WarehouseOption[] = [];

  if (user) {
    const { data: supplier } = await supabase
      .from("suppliers")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle<{ id: string }>();

    if (supplier?.id) {
      const { data } = await supabase
        .from("warehouses")
        .select("id, name, is_primary, is_active")
        .eq("supplier_id", supplier.id)
        .eq("is_active", true)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true })
        .returns<Pick<WarehouseRow, "id" | "name" | "is_primary" | "is_active">[]>();

      warehouses = (data ?? []).map((w) => ({
        id: w.id,
        name: w.name,
        isPrimary: w.is_primary,
      }));
    }
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <header className="flex flex-col gap-3 lg:gap-4 border-b border-[color:var(--ios-separator,rgba(0,0,0,0.08))] pb-3 lg:pb-4 md:flex-row md:items-center md:justify-between">
        <nav
          className="flex items-center gap-1 overflow-x-auto lg:flex-wrap [-webkit-overflow-scrolling:touch] px-3 lg:px-0 -mx-3 lg:mx-0"
          aria-label="Sezioni magazzino"
          style={{ scrollbarWidth: "none" }}
        >
          {SUBNAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-md px-3 py-2 text-[13px] lg:text-sm font-medium text-sage transition-colors hover:bg-carbon hover:text-charcoal aria-[current=page]:bg-accent-green/10 aria-[current=page]:text-accent-green"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center justify-end px-3 lg:px-0">
          <WarehouseSwitcher warehouses={warehouses} />
        </div>
      </header>
      <div>{children}</div>
    </div>
  );
}
