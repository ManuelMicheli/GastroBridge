import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  getFiscalEnabled,
  getRestaurantsForCurrentUser,
} from "@/lib/fiscal/queries";
import { listReorderSuggestions } from "@/lib/fiscal/reorder";
import { FinanzeEmpty } from "../_components/finanze-empty";
import { OrdiniConsigliatiClient } from "./ordini-client";

export const metadata: Metadata = { title: "Ordini consigliati" };

export default async function OrdiniConsigliatiPage({
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
          body="Crea una sede prima."
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

  const enabled = await getFiscalEnabled(selectedId);
  if (!enabled) {
    return (
      <div className="p-6">
        <FinanzeEmpty
          heading="Cassetto Fiscale non attivo"
          body="Attiva la feature per ricevere suggerimenti di riordino basati sulle vendite POS."
          ctaLabel="Vai al dashboard"
          ctaHref={`/finanze?r=${selectedId}`}
        />
      </div>
    );
  }

  const suggestions = await listReorderSuggestions(selectedId, "open");

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
            Cassetto Fiscale · Reorder engine
          </p>
          <h1 className="text-2xl font-semibold text-text-primary">
            Ordini consigliati
          </h1>
        </div>
      </div>

      <OrdiniConsigliatiClient
        restaurantId={selectedId}
        suggestions={suggestions}
      />
    </div>
  );
}
