import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { RoleGate } from "@/components/supplier/shared/role-gate";
import { FeatureFlagGate } from "@/components/supplier/shared/feature-flag-gate";
import { isPhase1Enabled } from "@/lib/supplier/feature-flags";
import { InviteForm } from "./invite-form";
import type { SupplierRole } from "@/types/database";

export const metadata: Metadata = { title: "Invita membro" };

export default async function SupplierInviteMemberPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Card className="text-center py-16">
        <p className="text-sage">Sessione non valida.</p>
      </Card>
    );
  }

  const { data: member } = await supabase
    .from("supplier_members")
    .select("role, supplier_id")
    .eq("profile_id", user.id)
    .eq("is_active", true)
    .not("accepted_at", "is", null)
    .limit(1)
    .maybeSingle<{ role: SupplierRole; supplier_id: string }>();

  if (!member) {
    return (
      <Card className="text-center py-16">
        <p className="text-sage">Nessuna appartenenza attiva.</p>
      </Card>
    );
  }

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, feature_flags")
    .eq("id", member.supplier_id)
    .maybeSingle<{ id: string; feature_flags: Record<string, unknown> }>();

  const phase1Enabled = isPhase1Enabled(supplier);

  const fallback = (
    <Card className="text-center py-16">
      <p className="text-sage">
        La gestione dello staff non è disponibile.
      </p>
    </Card>
  );

  return (
    <FeatureFlagGate enabled={phase1Enabled} fallback={fallback}>
      <RoleGate
        currentRole={member.role}
        allowed={["admin"]}
        fallback={fallback}
      >
        <div className="max-w-xl">
          <h1 className="text-2xl font-bold text-charcoal mb-2">
            Invita un membro
          </h1>
          <p className="text-sm text-sage mb-6">
            Invia un invito via email. Il destinatario riceverà un link per
            accedere e unirsi al team.
          </p>
          <InviteForm supplierId={member.supplier_id} />
        </div>
      </RoleGate>
    </FeatureFlagGate>
  );
}
