import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { NewProductForm } from "@/components/supplier/catalog/new-product-form";

export const metadata: Metadata = { title: "Nuovo prodotto" };

export default async function NewProductPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("profile_id", user?.id ?? "")
    .single<{ id: string }>();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .order("name", { ascending: true })
    .returns<Array<{ id: string; name: string }>>();

  if (!supplier) {
    return (
      <div>
        <Link
          href="/supplier/catalogo"
          className="flex items-center gap-2 text-sage hover:text-charcoal mb-4 text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Torna al catalogo
        </Link>
        <Card className="text-center py-16">
          <p className="text-sage">Profilo fornitore non trovato.</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/supplier/catalogo"
        className="flex items-center gap-2 text-sage hover:text-charcoal mb-4 text-sm"
      >
        <ArrowLeft className="h-4 w-4" /> Torna al catalogo
      </Link>
      <h1 className="text-2xl font-bold text-charcoal mb-6">Nuovo Prodotto</h1>
      <Card className="max-w-2xl">
        <NewProductForm
          supplierId={supplier.id}
          categories={categories ?? []}
        />
      </Card>
    </div>
  );
}
