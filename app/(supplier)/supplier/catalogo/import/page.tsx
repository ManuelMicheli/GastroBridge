import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ImportClient } from "./import-client";
import type { CategoryOption } from "@/components/supplier/catalog/product-import-wizard";

export const metadata: Metadata = { title: "Importa listino" };
// Server actions of this page (commitSupplierImport) write up to 5.000 products.
export const maxDuration = 60;

export default async function ImportCSVPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name")
    .order("sort_order", { ascending: true })
    .returns<CategoryOption[]>();

  return <ImportClient categories={data ?? []} />;
}
