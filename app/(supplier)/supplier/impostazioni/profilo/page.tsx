import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { ProfileClient } from "./profile-client";
import {
  getEditableSupplierProfile,
  type EditableSupplierProfile,
} from "@/lib/supplier/profile/actions";
import { getCurrentSupplierMember, memberCan } from "@/lib/supplier/current-member";

export const metadata: Metadata = { title: "Profilo pubblico" };

export default async function SupplierProfilePage() {
  const member = await getCurrentSupplierMember();
  const supplier = member ? { id: member.supplier_id } : null;
  // Same gate as the sidebar (lib/supplier/permissions.ts ROLE_MATRIX).
  if (member && !memberCan(member, "settings.manage")) redirect("/supplier/dashboard");

  if (!supplier?.id) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-charcoal mb-6">
          Profilo pubblico
        </h1>
        <Card className="text-center py-16">
          <p className="text-sage">
            Nessun profilo fornitore associato a questo utente.
          </p>
        </Card>
      </div>
    );
  }

  const res = await getEditableSupplierProfile(supplier.id);
  if (!res.ok) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-charcoal mb-6">
          Profilo pubblico
        </h1>
        <Card className="text-center py-16">
          <p className="text-red-600">{res.error}</p>
        </Card>
      </div>
    );
  }

  const profile: EditableSupplierProfile = res.data;
  return <ProfileClient supplierId={supplier.id} initialProfile={profile} />;
}
