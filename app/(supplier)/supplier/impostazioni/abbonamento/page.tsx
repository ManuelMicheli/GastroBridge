import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SUPPLIER_PLANS } from "@/lib/utils/constants";
import { Check } from "lucide-react";

export default function SupplierSubscriptionPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal mb-6">Abbonamento</h1>
      <Card className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-sage">Piano attuale</p>
            <p className="text-2xl font-bold text-charcoal">Base</p>
          </div>
          <Badge variant="success">Attivo</Badge>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {SUPPLIER_PLANS.map((plan) => (
          <Card key={plan.id} className={plan.highlighted ? "ring-2 ring-forest" : ""}>
            {plan.highlighted && <Badge variant="success" className="mb-3">Consigliato</Badge>}
            <h3 className="text-xl font-bold">{plan.name}</h3>
            <div className="flex items-baseline gap-1 mb-4 mt-1">
              <span className="text-3xl font-mono font-bold">€{plan.price}</span>
              <span className="text-sage">/{plan.period}</span>
            </div>
            <ul className="space-y-2 mb-6">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-forest mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Button variant={plan.highlighted ? "primary" : "secondary"} className="w-full">
              {plan.id === "base" ? "Piano attuale" : "Upgrade"}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
