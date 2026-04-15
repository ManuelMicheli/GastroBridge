import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/restaurants/preferences";
import { PreferencesClient } from "./preferences-client";

export const metadata: Metadata = { title: "Esigenze di fornitura" };

export default async function SupplyPreferencesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-charcoal mb-2">
          Esigenze di fornitura
        </h1>
        <p className="text-sage">Accedi per configurare le tue preferenze.</p>
      </div>
    );
  }

  const { data: restaurants } = await supabase
    .from("restaurants")
    .select("id, name, is_primary, created_at")
    .eq("profile_id", user.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .returns<
      Array<{
        id: string;
        name: string;
        is_primary: boolean | null;
        created_at: string | null;
      }>
    >();

  const primary = restaurants?.[0] ?? null;

  if (!primary) {
    return (
      <div>
        <Link
          href="/impostazioni"
          className="inline-flex items-center gap-1 text-sm text-sage hover:text-charcoal mb-4"
        >
          <ChevronLeft className="h-4 w-4" /> Impostazioni
        </Link>
        <h1 className="text-2xl font-bold text-charcoal mb-2">
          Esigenze di fornitura
        </h1>
        <p className="text-sage">
          Crea almeno una sede prima di configurare le preferenze di fornitura.
        </p>
      </div>
    );
  }

  const prefs = await getPreferences(primary.id);

  return (
    <div>
      <Link
        href="/impostazioni"
        className="inline-flex items-center gap-1 text-sm text-sage hover:text-charcoal mb-4"
      >
        <ChevronLeft className="h-4 w-4" /> Impostazioni
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-charcoal">
          Esigenze di fornitura
        </h1>
        <p className="text-sage mt-1">
          Configura le tue priorità: ti aiuteremo a trovare i fornitori migliori
          per <span className="font-semibold">{primary.name}</span>.
        </p>
      </div>

      {prefs.ok ? (
        <PreferencesClient
          restaurantId={primary.id}
          initialGlobal={prefs.data.global}
          initialByCategory={prefs.data.byCategory}
        />
      ) : (
        <p className="text-red-600">Errore caricamento: {prefs.error}</p>
      )}
    </div>
  );
}
