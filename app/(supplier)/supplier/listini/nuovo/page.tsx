import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { NuovoListinoForm } from "@/components/supplier/pricing/nuovo-listino-form";
import { getCurrentSupplierMember, memberCan } from "@/lib/supplier/current-member";

export const metadata: Metadata = { title: "Nuovo listino" };

export default async function NuovoListinoPage() {
  const member = await getCurrentSupplierMember();
  const supplier = member ? { id: member.supplier_id } : null;
  // Same gate as the sidebar (lib/supplier/permissions.ts ROLE_MATRIX).
  if (member && !memberCan(member, "pricing.edit")) redirect("/supplier/dashboard");

  if (!supplier?.id) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-text-primary mb-6">
          Nuovo listino
        </h1>
        <Card className="text-center py-16">
          <p className="text-text-secondary">
            Nessun profilo fornitore associato a questo utente.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-text-primary mb-1">
        Nuovo listino
      </h1>
      <p className="text-sm text-text-secondary mb-6">
        Crea un listino prezzi. Potrai popolare le righe nell&apos;editor.
      </p>
      <NuovoListinoForm supplierId={supplier.id} />
    </div>
  );
}
