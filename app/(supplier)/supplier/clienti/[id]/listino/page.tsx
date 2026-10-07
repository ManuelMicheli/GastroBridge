/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { getRelationshipById } from "@/lib/relationships/queries";
import { getPriceListByRelationship } from "@/lib/price-lists/queries";
import { PriceListEditor } from "./editor";
import { getCurrentSupplierMember } from "@/lib/supplier/current-member";

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

  const member = await getCurrentSupplierMember();
  if (!member || member.supplier_id !== rel.supplier_id) notFound();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("name")
    .eq("id", rel.restaurant_id)
    .maybeSingle<{ name: string }>();

  // Tutti i prodotti del fornitore (per select nel form)
  const { data: products } = await supabase
    .from("products")
    .select("id, name, unit, price")
    .eq("supplier_id", member.supplier_id)
    .eq("is_available", true)
    .order("name", { ascending: true })
    .returns<{ id: string; name: string; unit: string | null; price: number | null }[]>();

  const entries = await getPriceListByRelationship(id);

  // Named price list that applies to this client (Listini): the assigned one,
  // otherwise the supplier's default list.
  const { data: assignment } = await supabase
    .from("customer_price_assignments")
    .select("price_list_id, price_lists(id, name)")
    .eq("supplier_id", member.supplier_id)
    .eq("restaurant_id", rel.restaurant_id)
    .maybeSingle<{ price_list_id: string; price_lists: { id: string; name: string } | null }>();
  const { data: defaultList } = assignment?.price_lists
    ? { data: null }
    : await supabase
        .from("price_lists")
        .select("id, name")
        .eq("supplier_id", member.supplier_id)
        .eq("is_default", true)
        .maybeSingle<{ id: string; name: string }>();
  const appliedList = assignment?.price_lists ?? defaultList ?? null;

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
      <p className="text-sage mb-2">
        I prezzi personalizzati sostituiscono il prezzo di catalogo quando il ristoratore consulta i tuoi prodotti.
      </p>
      <p className="text-sm text-sage mb-6">
        Listino applicato:{" "}
        {appliedList ? (
          <Link href={`/supplier/listini/${appliedList.id}`} className="font-medium text-accent-green hover:underline">
            {appliedList.name}
            {assignment?.price_lists ? "" : " (predefinito)"}
          </Link>
        ) : (
          <span className="font-medium">nessuno</span>
        )}
        {" · "}
        <Link href="/supplier/listini" className="hover:underline">
          gestisci i listini
        </Link>
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
