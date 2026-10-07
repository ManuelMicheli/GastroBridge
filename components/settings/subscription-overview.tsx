// Informational subscription page shared by the restaurant and supplier areas.
//
// Billing is not live yet: there is no "current plan" to show and no checkout to
// start, so this page only presents the plans (names + features from
// lib/utils/constants.ts), the commercial terms that are already decided
// (flat fee, no commission on orders, 14-day free trial) and a way to contact
// us. Prices are not public yet — every plan reads "Prezzi in arrivo".

import { Check, Mail, Percent, CalendarClock, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { LargeTitle } from "@/components/ui/large-title";
import { FCard, StatusPill } from "@/components/fernly/primitives";
import { SUPPORT_EMAIL, type PlanDefinition } from "@/lib/utils/constants";

type Props = {
  plans: PlanDefinition[];
  /** Plan id stored in the user's signup metadata (`user_metadata.plan`). */
  chosenPlanId?: string | null;
  /** Mobile hero eyebrow. */
  eyebrow: string;
};

const TERMS = [
  {
    icon: Percent,
    title: "Canone fisso, nessuna commissione sugli ordini",
    body: "Paghi un abbonamento mensile: sugli ordini non tratteniamo nulla.",
  },
  {
    icon: CalendarClock,
    title: "14 giorni di prova gratuita",
    body: "Provi la piattaforma completa prima di scegliere il piano.",
  },
] as const;

export function SubscriptionOverview({ plans, chosenPlanId, eyebrow }: Props) {
  const chosenPlan = chosenPlanId ? plans.find((p) => p.id === chosenPlanId) ?? null : null;
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Informazioni abbonamento GastroBridge")}`;

  return (
    <div>
      <div className="lg:hidden">
        <LargeTitle eyebrow={eyebrow} title="Abbonamento" subtitle="Piani e condizioni" />
      </div>
      <PageHeader
        className="hidden lg:flex"
        title="Abbonamento"
        subtitle="I piani di GastroBridge e le condizioni già definite. I prezzi saranno pubblicati a breve."
      />

      <div className="mt-3 flex flex-col gap-3 px-3 lg:mt-0 lg:gap-4 lg:px-0">
        {chosenPlan ? (
          <FCard index={0} ariaLabel="Piano scelto in registrazione">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[var(--acc-50)] text-[var(--acc-700)]">
                <Sparkles className="h-4 w-4" aria-hidden />
              </span>
              <p className="min-w-0 flex-1 text-[14px] text-[var(--f-ink)]">
                Piano scelto in registrazione: <strong className="font-semibold">{chosenPlan.name}</strong>
              </p>
            </div>
          </FCard>
        ) : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:gap-4">
          {TERMS.map((t, i) => (
            <FCard key={t.title} index={i + 1}>
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[var(--acc-50)] text-[var(--acc-700)]">
                  <t.icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 className="f-card-title">{t.title}</h2>
                  <p className="mt-1 text-[13px] text-[var(--f-muted)]">{t.body}</p>
                </div>
              </div>
            </FCard>
          ))}
        </div>

        <div
          className="grid gap-3 lg:gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))" }}
        >
          {plans.map((plan, i) => (
            <FCard
              key={plan.id}
              index={i + 3}
              ariaLabel={`Piano ${plan.name}`}
              className={plan.highlighted ? "ring-2 ring-[var(--acc-600)]" : undefined}
              title={plan.name}
              action={
                plan.highlighted ? (
                  <StatusPill tone="accent">Consigliato</StatusPill>
                ) : chosenPlan?.id === plan.id ? (
                  <StatusPill tone="neutral">Scelto</StatusPill>
                ) : null
              }
            >
              <p className="text-[22px] font-medium leading-tight tracking-[-0.02em] text-[var(--f-ink)]">
                Prezzi in arrivo
              </p>
              <p className="mt-1 text-[12.5px] text-[var(--f-muted)]">Canone fisso mensile · 0% commissioni</p>
              <ul className="mt-4 flex flex-col gap-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13.5px] text-[var(--f-ink-2)]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--acc-600)]" aria-hidden />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </FCard>
          ))}
        </div>

        <FCard index={plans.length + 3}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="f-card-title">Vuoi sapere di più?</h2>
              <p className="mt-1 text-[13px] text-[var(--f-muted)]">
                Scrivici per i prezzi, la prova gratuita o per capire quale piano fa per te.
              </p>
            </div>
            <a href={mailto} className="f-btn f-btn-primary shrink-0">
              <Mail className="h-4 w-4" aria-hidden />
              Contattaci
            </a>
          </div>
        </FCard>
      </div>
    </div>
  );
}
