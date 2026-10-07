import type { Metadata } from "next";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { FCard } from "@/components/fernly/primitives";
import { getTeamForActiveRestaurant } from "@/lib/restaurants/team/queries";
import { RESTAURANT_ROLE_LABELS } from "@/lib/restaurants/permissions";
import { TeamClient } from "./team-client";
import { RestaurantSwitcher } from "./restaurant-switcher";

export const metadata: Metadata = { title: "Team — Impostazioni" };

export default async function TeamPage() {
  const res = await getTeamForActiveRestaurant();
  const ctx = res.ctx;

  const switcher =
    ctx && ctx.restaurants.length > 1 ? (
      <RestaurantSwitcher
        activeId={ctx.restaurantId}
        restaurants={ctx.restaurants.map((r) => ({
          id: r.restaurantId,
          name: r.name,
          roleLabel: RESTAURANT_ROLE_LABELS[r.isOwner ? "owner" : r.role],
          isOwner: r.isOwner,
        }))}
      />
    ) : null;

  if (!res.ok) {
    const body =
      res.reason === "no_restaurant"
        ? "Nessun ristorante associato al tuo account."
        : res.reason === "forbidden"
          ? `Il tuo ruolo è ${RESTAURANT_ROLE_LABELS[ctx?.role ?? "viewer"]}: solo il titolare può invitare persone e gestire i ruoli.`
          : (res.error ?? "Impossibile caricare il team.");
    return (
      <div className="px-1 pt-3 lg:px-0 lg:pt-0">
        <PageHeader
          title="Team"
          subtitle={ctx ? `Chi lavora su ${ctx.restaurantName}` : "Invita i membri e gestisci i ruoli"}
        />
        <div className="flex flex-col gap-4">
          <FCard index={0}>
            <div className="flex flex-col items-center py-10 text-center">
              <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--f-fill)]">
                <Users className="h-5 w-5 text-[var(--f-muted)]" aria-hidden />
              </span>
              <p className="f-card-title">
                {res.reason === "forbidden" ? "Accesso limitato" : "Team non disponibile"}
              </p>
              <p className="mt-1.5 max-w-sm text-[13.5px] text-[var(--f-muted)]">{body}</p>
            </div>
          </FCard>
          {switcher}
        </div>
      </div>
    );
  }

  return (
    <TeamClient
      restaurantName={res.restaurant.name}
      members={res.members}
      switcher={switcher}
    />
  );
}
