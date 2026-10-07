import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { contextCan, getRestaurantContext } from "@/lib/restaurants/context";
import { RESTAURANT_ROLE_LABELS } from "@/lib/restaurants/permissions";
import { RestrictedSettings } from "../_components/restricted-settings";
import { getPreferences } from "@/lib/restaurants/preferences";
import { PreferencesClient } from "./preferences-client";
import { LargeTitle } from "@/components/ui/large-title";

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

  // Active restaurant (owner or team member with settings.manage).
  const ctx = await getRestaurantContext();
  if (ctx && !contextCan(ctx, "settings.manage")) {
    return (
      <RestrictedSettings
        title="Esigenze di fornitura"
        body={`Le priorità di fornitura di ${ctx.restaurantName} sono gestite dal titolare o da un manager (il tuo ruolo: ${RESTAURANT_ROLE_LABELS[ctx.role]}).`}
      />
    );
  }
  const primary = ctx ? { id: ctx.restaurantId, name: ctx.restaurantName } : null;

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
      {/* Mobile hero */}
      <div className="lg:hidden">
        <LargeTitle
          eyebrow="Impostazioni"
          title="Esigenze di fornitura"
          subtitle={`Priorità per ${primary.name}`}
        />
      </div>

      {/* Desktop header */}
      <div className="hidden lg:block">
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
      </div>

      <div className="px-3 lg:px-0 mt-3 lg:mt-0">
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
    </div>
  );
}
