/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { getRelationshipById } from "@/lib/relationships/queries";
import { getPriceListByRelationship } from "@/lib/price-lists/queries";
import { PriceListEditor } from "./editor";

type Params = Promise<{ id: string }>;

export default async function ListinoPage({ params }: { params: Params }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const rel = await getRelationshipById(id);
  if (!rel) notFound();
  if (rel.status !== "active") notFound();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("id", rel.supplier_id)
    .eq("profile_id", user.id)
    .maybeSingle<{ id: string }>();
  if (!supplier) notFound();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("name")
    .eq("id", rel.restaurant_id)
    .maybeSingle<{ name: string }>();

  // Tutti i prodotti del fornitore (per select nel form)
  const { data: products } = await supabase
    .from("products")
    .select("id, name, unit, price")
    .eq("supplier_id", supplier.id)
    .eq("is_available", true)
    .order("name", { ascending: true })
    .returns<{ id: string; name: string; unit: string | null; price: number | null }[]>();

  const entries = await getPriceListByRelationship(id);

  return (
    <div>
      <Link
        href={`/supplier/clienti/${id}`}
        className="inline-flex items-center gap-1 text-sm text-sage hover:text-charcoal mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Torna al cliente
      </Link>

      <h1 className="text-2xl font-bold text-charcoal mb-2">
        Listino per {restaurant?.name ?? "cliente"}
      </h1>
      <p className="text-sage mb-6">
        I prezzi personalizzati sostituiscono il prezzo di catalogo quando il ristoratore consulta i tuoi prodotti.
      </p>

      {(products ?? []).length === 0 ? (
        <Card className="text-center py-10">
          <p className="text-sage">
            Non hai prodotti attivi. Aggiungili dal{" "}
            <Link href="/supplier/catalogo" className="text-accent-green hover:underline">
              catalogo
            </Link>{" "}
            prima di creare un listino.
          </p>
        </Card>
      ) : (
        <PriceListEditor
          relationshipId={id}
          products={products ?? []}
          initialEntries={entries}
        />
      )}
    </div>
  );
}
