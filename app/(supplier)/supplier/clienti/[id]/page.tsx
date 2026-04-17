/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Utensils, List, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { RelationshipStatusBadge } from "@/components/shared/relationship-status-badge";
import { MessageThread } from "@/components/shared/message-thread";
import { getRelationshipById } from "@/lib/relationships/queries";
import { getMessagesForRelationship } from "@/lib/messages/queries";
import { formatDate } from "@/lib/utils/formatters";
import { ClientActions } from "../client-actions";

type Params = Promise<{ id: string }>;

export default async function ClienteDetailPage({ params }: { params: Params }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const rel = await getRelationshipById(id);
  if (!rel) notFound();

  // Verifica: l'utente deve essere il fornitore della relazione
  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("id", rel.supplier_id)
    .eq("profile_id", user.id)
    .maybeSingle<{ id: string }>();
  if (!supplier) notFound();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name, city, province, cuisine, covers, phone, email")
    .eq("id", rel.restaurant_id)
    .maybeSingle<{
      id: string;
      name: string;
      city: string | null;
      province: string | null;
      cuisine: string | null;
      covers: number | null;
      phone: string | null;
      email: string | null;
    }>();

  const messages = await getMessagesForRelationship(id);

  // Storico ordini (via order_splits → orders)
  const { data: splits } = await (supabase as any)
    .from("order_splits")
    .select("id, subtotal, status, order_id, orders!inner(id, created_at, restaurant_id, total)")
    .eq("supplier_id", supplier.id)
    .eq("orders.restaurant_id", rel.restaurant_id)
    .order("created_at", { ascending: false, foreignTable: "orders" })
    .limit(10) as {
      data:
        | {
            id: string;
            subtotal: number;
            status: string;
            order_id: string;
            orders: { id: string; created_at: string; restaurant_id: string; total: number } | null;
          }[]
        | null;
    };

  const chatDisabled = rel.status === "rejected" || rel.status === "archived";

  return (
    <div>
      <RealtimeRefresh
        subscriptions={[
          { table: "restaurant_suppliers", filter: `id=eq.${id}` },
          { table: "partnership_messages", filter: `relationship_id=eq.${id}` },
        ]}
      />

      <Link
        href="/supplier/clienti"
        className="inline-flex items-center gap-1 text-sm text-sage hover:text-charcoal mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Torna ai clienti
      </Link>

      <Card className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="text-2xl font-bold text-charcoal">
                {restaurant?.name ?? "Ristoratore"}
              </h1>
              <RelationshipStatusBadge status={rel.status} />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-sage mt-2">
              {restaurant?.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" /> {restaurant.city}
                  {restaurant.province ? ` (${restaurant.province})` : ""}
                </span>
              )}
              {restaurant?.cuisine && (
                <span className="flex items-center gap-1 capitalize">
                  <Utensils className="h-4 w-4" /> {restaurant.cuisine}
                </span>
              )}
              {restaurant?.covers !== null && restaurant?.covers !== undefined && (
                <span>{restaurant.covers} coperti</span>
              )}
            </div>
            <p className="text-xs text-sage mt-2">
              {rel.status === "pending"
                ? `Richiesta ricevuta il ${formatDate(rel.invited_at)}`
                : `Partnership dal ${formatDate(rel.responded_at ?? rel.invited_at)}`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <ClientActions relationshipId={rel.id} status={rel.status} />
            {rel.status === "active" && (
              <Link
                href={`/supplier/clienti/${rel.id}/listino`}
                className="inline-flex items-center gap-1 text-sm text-accent-green hover:underline"
              >
                <List className="h-4 w-4" /> Listino personalizzato
              </Link>
            )}
          </div>
        </div>
      </Card>

      <div className="cq-section grid grid-cols-1 @[900px]:grid-cols-3 gap-6 mb-6">
        <Card className="@[900px]:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle className="h-5 w-5 text-forest" />
            <h2 className="font-bold text-charcoal">Messaggi</h2>
          </div>
          <MessageThread
            relationshipId={rel.id}
            currentUserId={user.id}
            initialMessages={messages}
            disabled={chatDisabled}
            disabledReason="Relazione non attiva."
          />
        </Card>

        <Card>
          <h2 className="font-bold text-charcoal mb-3">Storico ordini</h2>
          {(splits ?? []).length === 0 ? (
            <p className="text-sm text-sage">Nessun ordine ricevuto da questo cliente.</p>
          ) : (
            <ul className="space-y-2">
              {(splits ?? []).map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between text-sm border-b border-sage-muted/20 pb-2 last:border-0"
                >
                  <div>
                    <p className="font-semibold text-charcoal">
                      {s.orders?.created_at ? formatDate(s.orders.created_at) : "—"}
                    </p>
                    <p className="text-xs text-sage capitalize">{s.status}</p>
                  </div>
                  <span className="font-mono font-bold text-forest">
                    € {Number(s.subtotal ?? 0).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
