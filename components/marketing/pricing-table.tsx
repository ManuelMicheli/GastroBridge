"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/formatters";
import { RESTAURANT_PLANS, SUPPLIER_PLANS, type PlanDefinition } from "@/lib/utils/constants";
import { motion, AnimatePresence } from "motion/react";

function PlanCard({ plan, role }: { plan: PlanDefinition; role: string }) {
  return (
    <motion.div
      layout
      className={cn(
        "bg-white rounded-2xl p-8 shadow-card relative flex flex-col",
        plan.highlighted && "ring-2 ring-forest shadow-elevated"
      )}
    >
      {plan.highlighted && (
        <Badge variant="success" className="absolute -top-3 left-1/2 -translate-x-1/2">
          Piu popolare
        </Badge>
      )}
      <h3 className="text-xl font-bold text-charcoal mb-1">{plan.name}</h3>
      <div className="flex items-baseline gap-1 mb-6">
        <span className="text-4xl font-mono font-bold text-charcoal">
          {plan.price === 0 ? "Gratis" : `€${plan.price}`}
        </span>
        {plan.price > 0 && <span className="text-sage">/{plan.period}</span>}
      </div>
      <ul className="space-y-3 mb-8 flex-1">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <Check className="h-4 w-4 text-forest mt-0.5 shrink-0" />
            <span className="text-charcoal">{feature}</span>
          </li>
        ))}
      </ul>
      <Link href={`/signup?role=${role}&plan=${plan.id}`}>
        <Button
          variant={plan.highlighted ? "primary" : "secondary"}
          className="w-full"
        >
          {plan.price === 0 ? "Inizia Gratis" : "Scegli Piano"}
        </Button>
      </Link>
    </motion.div>
  );
}

export function PricingTable() {
  const [tab, setTab] = useState<"restaurant" | "supplier">("restaurant");
  const plans = tab === "restaurant" ? RESTAURANT_PLANS : SUPPLIER_PLANS;

  return (
    <div>
      {/* Tab switcher */}
      <div className="flex justify-center mb-12">
        <div className="inline-flex bg-sage-muted/30 rounded-xl p-1">
          <button
            onClick={() => setTab("restaurant")}
            className={cn(
              "px-6 py-2.5 rounded-lg text-sm font-semibold transition-all",
              tab === "restaurant"
                ? "bg-white text-charcoal shadow-sm"
                : "text-sage hover:text-charcoal"
            )}
          >
            Per Ristoratori
          </button>
          <button
            onClick={() => setTab("supplier")}
            className={cn(
              "px-6 py-2.5 rounded-lg text-sm font-semibold transition-all",
              tab === "supplier"
                ? "bg-white text-charcoal shadow-sm"
                : "text-sage hover:text-charcoal"
            )}
          >
            Per Fornitori
          </button>
        </div>
      </div>

      {/* Plans grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} role={tab} />
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
