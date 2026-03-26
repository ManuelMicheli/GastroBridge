import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Plus } from "lucide-react";

export default function DeliveryZonesPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-charcoal">Zone di Consegna</h1>
        <Button size="sm"><Plus className="h-4 w-4" /> Nuova Zona</Button>
      </div>
      <Card className="text-center py-16">
        <MapPin className="h-12 w-12 text-sage-muted mx-auto mb-4" />
        <p className="text-sage mb-2">Nessuna zona di consegna configurata.</p>
        <p className="text-xs text-sage">Aggiungi le province o i CAP dove effettui le consegne.</p>
      </Card>
    </div>
  );
}
