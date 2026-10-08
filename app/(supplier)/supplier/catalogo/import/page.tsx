import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentSupplierMember, memberCan } from "@/lib/supplier/current-member";
import { ImportClient } from "./import-client";
import type { CategoryOption } from "@/components/supplier/catalog/product-import-wizard";

export const metadata: Metadata = { title: "Importa listino" };
// Server actions of this page (commitSupplierImport) write up to 5.000 products.
export const maxDuration = 60;

export default async function ImportCSVPage() {
  const member = await getCurrentSupplierMember();
  if (!memberCan(member, "catalog.edit")) {
    return (
      <div className="px-1 pt-3 lg:px-0 lg:pt-0">
        <Link href="/supplier/catalogo" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-[var(--f-muted)] hover:text-[var(--f-ink)]">
          <ArrowLeft className="h-4 w-4" /> Torna al catalogo
        </Link>
        <div className="f-card px-6 py-10 text-center text-[14px] text-[var(--f-muted)]">
          Il tuo ruolo non consente di modificare il catalogo. Chiedi al titolare o a un amministratore.
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name")
    .order("sort_order", { ascending: true })
    .returns<CategoryOption[]>();

  return <ImportClient categories={data ?? []} />;
}
