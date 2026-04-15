import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { ListiniClient } from "./listini-client";
import type { Database } from "@/types/database";

type PriceListRow = Database["public"]["Tables"]["price_lists"]["Row"];

export const metadata: Metadata = { title: "Listini prezzi" };

type ListinoSummary = PriceListRow & {
  items_count: number;
  customers_count: number;
};

export default async function ListiniPage() {
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
      <div>
        <h1 className="text-2xl font-bold text-text-primary mb-6">
          Listini prezzi
        </h1>
        <Card className="text-center py-16">
          <p className="text-text-secondary">
            Nessun profilo fornitore associato a questo utente.
          </p>
        </Card>
      </div>
    );
  }

  const { data: lists } = await supabase
    .from("price_lists")
    .select("*")
    .eq("supplier_id", supplier.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .returns<PriceListRow[]>();

  const listsArr = lists ?? [];
  const listIds = listsArr.map((l) => l.id);

  // counts price_list_items per list
  const itemsCountMap = new Map<string, number>();
  const customersCountMap = new Map<string, number>();

  if (listIds.length > 0) {
    const { data: itemsRows } = await supabase
      .from("price_list_items")
      .select("price_list_id")
      .in("price_list_id", listIds)
      .returns<Array<{ price_list_id: string }>>();
    for (const r of itemsRows ?? []) {
      itemsCountMap.set(
        r.price_list_id,
        (itemsCountMap.get(r.price_list_id) ?? 0) + 1,
      );
    }

    const { data: custRows } = await supabase
      .from("customer_price_assignments")
      .select("price_list_id")
      .in("price_list_id", listIds)
      .returns<Array<{ price_list_id: string }>>();
    for (const r of custRows ?? []) {
      customersCountMap.set(
        r.price_list_id,
        (customersCountMap.get(r.price_list_id) ?? 0) + 1,
      );
    }
  }

  const withCounts: ListinoSummary[] = listsArr.map((l) => ({
    ...l,
    items_count: itemsCountMap.get(l.id) ?? 0,
    customers_count: customersCountMap.get(l.id) ?? 0,
  }));

  return <ListiniClient supplierId={supplier.id} initialLists={withCounts} />;
}
