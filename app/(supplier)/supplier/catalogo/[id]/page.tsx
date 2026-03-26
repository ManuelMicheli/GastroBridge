import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single<{ id: string; name: string }>();

  if (!product) notFound();

  return (
    <div>
      <Link href="/supplier/catalogo" className="flex items-center gap-2 text-sage hover:text-charcoal mb-4 text-sm">
        <ArrowLeft className="h-4 w-4" /> Torna al catalogo
      </Link>
      <h1 className="text-2xl font-bold text-charcoal mb-6">Modifica: {product.name}</h1>
      <Card className="max-w-2xl">
        <p className="text-sage">Form di modifica prodotto — funzionalita completa nel prossimo aggiornamento.</p>
      </Card>
    </div>
  );
}
