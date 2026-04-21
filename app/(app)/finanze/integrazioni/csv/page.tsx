import type { Metadata } from "next";
import {
  getFiscalEnabled,
  getRestaurantsForCurrentUser,
} from "@/lib/fiscal/queries";
import { FinanzeEmpty } from "../../_components/finanze-empty";
import { CsvClient } from "./csv-client";

export const metadata: Metadata = { title: "Import CSV" };

export default async function CsvImportPage({
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
          body="Crea una sede prima di importare scontrini."
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
          body="Attiva la feature nelle integrazioni prima di importare CSV."
          ctaLabel="Integrazioni"
          ctaHref={`/finanze/integrazioni?r=${selectedId}`}
        />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      <CsvClient restaurantId={selectedId} />
    </div>
  );
}
