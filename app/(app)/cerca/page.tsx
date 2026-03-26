import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SearchPageClient } from "./search-client";

export const metadata: Metadata = { title: "Cerca Prodotti" };

export default async function SearchPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug")
    .order("sort_order");

  return <SearchPageClient categories={categories ?? []} />;
}
