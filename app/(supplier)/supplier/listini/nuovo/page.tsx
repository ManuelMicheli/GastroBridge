import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { NuovoListinoForm } from "@/components/supplier/pricing/nuovo-listino-form";

export const metadata: Metadata = { title: "Nuovo listino" };

export default async function NuovoListinoPage() {
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
          Nuovo listino
        </h1>
        <Card className="text-center py-16">
          <p className="text-text-secondary">
            Nessun profilo fornitore associato a questo utente.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-text-primary mb-1">
        Nuovo listino
      </h1>
      <p className="text-sm text-text-secondary mb-6">
        Crea un listino prezzi. Potrai popolare le righe nell&apos;editor.
      </p>
      <NuovoListinoForm supplierId={supplier.id} />
    </div>
  );
}
