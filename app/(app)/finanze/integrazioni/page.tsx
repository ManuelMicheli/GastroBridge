import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  getFiscalEnabled,
  getRestaurantsForCurrentUser,
  listIntegrations,
} from "@/lib/fiscal/queries";
import { FinanzeEmpty } from "../_components/finanze-empty";
import { IntegrazioniClient } from "./integrazioni-client";

export const metadata: Metadata = { title: "Integrazioni POS" };

export default async function IntegrazioniPage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string }>;
}) {
  const restaurants = await getRestaurantsForCurrentUser();
  if (restaurants.length === 0) {
    return (
      <div className="p-6">
        <FinanzeEmpty
          heading="Nessun ristorante"
          body="Crea una sede dalle impostazioni."
          ctaLabel="Impostazioni sedi"
          ctaHref="/impostazioni/sedi"
        />
      </div>
    );
  }

  const qs = await searchParams;
  const selectedId =
    qs.r && restaurants.find((r) => r.id === qs.r)
      ? qs.r
      : restaurants[0]!.id;

  const [enabled, integrations] = await Promise.all([
    getFiscalEnabled(selectedId),
    listIntegrations(selectedId),
  ]);

  const webhookBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://<your-domain>";

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link
          href={`/finanze?r=${selectedId}`}
          className="text-text-tertiary hover:text-text-secondary"
          aria-label="Torna al dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-tertiary font-bold">
            Cassetto Fiscale · Integrazioni
          </p>
          <h1 className="text-2xl font-semibold text-text-primary">
            POS collegati
          </h1>
        </div>
      </div>

      <IntegrazioniClient
        restaurantId={selectedId}
        fiscalEnabled={enabled}
        integrations={integrations}
        webhookBaseUrl={webhookBaseUrl}
      />
    </div>
  );
}
