import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { FCard } from "@/components/fernly/primitives";
import { createClient } from "@/lib/supabase/server";
import { getCurrentSupplierMember, memberCan } from "@/lib/supplier/current-member";
import { loadClientRefs } from "@/lib/supplier/intel/customers";
import { getPhoneOrderContext } from "@/lib/supplier/phone-order/queries";
import { ClientPicker, PhoneOrderForm } from "./phone-order-client";

export const metadata: Metadata = { title: "Nuovo ordine per un cliente — GastroBridge Fornitore" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ cliente?: string }>;

export default async function NewPhoneOrderPage({ searchParams }: { searchParams: SearchParams }) {
  const { cliente } = await searchParams;
  const member = await getCurrentSupplierMember();
  if (!member || !memberCan(member, "order.accept_line")) {
    return (
      <div className="px-1 pt-3 lg:px-0 lg:pt-0">
        <PageHeader title="Ordine telefonico" />
        <FCard>
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Lock className="h-5 w-5 text-[var(--f-muted)]" aria-hidden />
            <p className="text-[13px] text-[var(--f-muted)]">Solo amministratori e commerciali inseriscono ordini per i clienti.</p>
          </div>
        </FCard>
      </div>
    );
  }

  const supabase = await createClient();
  const back = (
    <Link href="/supplier/ordini" className="f-btn f-btn-ghost f-btn-sm">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Ordini
    </Link>
  );

  if (!cliente || !/^[0-9a-f-]{36}$/.test(cliente)) {
    const clients = await loadClientRefs(supabase, member.supplier_id, ["active"]);
    return (
      <div className="px-1 pt-3 lg:px-0 lg:pt-0">
        <PageHeader
          title="Ordine telefonico"
          subtitle="Il cliente chiama o scrive su WhatsApp: scegli il ristorante e inserisci l'ordine in pochi secondi."
          actions={back}
        />
        <ClientPicker
          clients={clients.map((c) => ({ id: c.relationshipId, name: c.name, city: c.city, phone: c.phone }))}
        />
      </div>
    );
  }

  const ctx = await getPhoneOrderContext(supabase, member.supplier_id, cliente);
  if (!ctx) {
    return (
      <div className="px-1 pt-3 lg:px-0 lg:pt-0">
        <PageHeader title="Ordine telefonico" actions={back} />
        <FCard>
          <p className="py-6 text-center text-[13px] text-[var(--f-muted)]">
            Cliente non trovato o relazione non attiva.{" "}
            <Link href="/supplier/ordini/nuovo" className="underline">
              Scegli un altro cliente
            </Link>
          </p>
        </FCard>
      </div>
    );
  }

  return (
    <div className="px-1 pt-3 lg:px-0 lg:pt-0">
      <PageHeader
        title={`Ordine per ${ctx.client.name}`}
        subtitle={[ctx.client.city, "ordine inserito dal fornitore per conto del cliente"].filter(Boolean).join(" · ")}
        actions={
          <Link href="/supplier/ordini/nuovo" className="f-btn f-btn-ghost f-btn-sm">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Cambia cliente
          </Link>
        }
      />
      <PhoneOrderForm ctx={ctx} />
    </div>
  );
}
