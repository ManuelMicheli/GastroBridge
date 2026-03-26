import type { Metadata } from "next";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Clienti" };

export default function ClientsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal mb-6">I tuoi Clienti</h1>
      <Card className="text-center py-16">
        <p className="text-sage">La lista dei ristoranti che hanno ordinato da te apparira qui.</p>
      </Card>
    </div>
  );
}
