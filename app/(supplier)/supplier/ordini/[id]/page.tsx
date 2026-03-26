import { Card } from "@/components/ui/card";

export default async function SupplierOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal mb-6">Dettaglio Ordine</h1>
      <Card>
        <p className="text-sage">Dettaglio ordine #{id.slice(0, 8)} — gestione status in sviluppo.</p>
      </Card>
    </div>
  );
}
