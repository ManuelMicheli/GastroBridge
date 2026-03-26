import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, MapPin } from "lucide-react";

export default function LocationsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-charcoal">Sedi</h1>
        <Button size="sm"><Plus className="h-4 w-4" /> Nuova Sede</Button>
      </div>
      <Card className="text-center py-16">
        <MapPin className="h-12 w-12 text-sage-muted mx-auto mb-4" />
        <p className="text-sage">Nessuna sede configurata. Aggiungi il tuo primo ristorante.</p>
      </Card>
    </div>
  );
}
