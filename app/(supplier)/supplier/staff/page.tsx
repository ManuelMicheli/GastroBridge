import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RoleGate } from "@/components/supplier/shared/role-gate";
import { FeatureFlagGate } from "@/components/supplier/shared/feature-flag-gate";
import { isPhase1Enabled } from "@/lib/supplier/feature-flags";
import { listMembers } from "@/lib/supplier/staff/actions";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { StaffClient } from "./staff-client";
import type { SupplierRole } from "@/types/database";
import { UserPlus, Users } from "lucide-react";
import { LargeTitle } from "@/components/ui/large-title";

export const metadata: Metadata = { title: "Staff" };

export default async function SupplierStaffPage() {
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
        <p className="text-sage">
          Nessuna appartenenza attiva. Contatta l&apos;amministratore.
        </p>
      </Card>
    );
  }

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, company_name, feature_flags")
    .eq("id", member.supplier_id)
    .maybeSingle<{
      id: string;
      company_name: string;
      feature_flags: Record<string, unknown>;
    }>();

  const phase1Enabled = isPhase1Enabled(supplier);

  const disabledState = (
    <div>
      <h1 className="font-display text-3xl text-text-primary mb-6">
        Staff<span className="text-brand-primary">.</span>
      </h1>
      <Card className="text-center py-16">
        <Users className="h-12 w-12 text-sage-muted mx-auto mb-4" />
        <p className="text-sage">
          La gestione dello staff non è abilitata per questo account.
        </p>
      </Card>
    </div>
  );

  const notAdminState = (
    <div>
      <h1 className="font-display text-3xl text-text-primary mb-6">
        Staff<span className="text-brand-primary">.</span>
      </h1>
      <Card className="text-center py-16">
        <Users className="h-12 w-12 text-sage-muted mx-auto mb-4" />
        <p className="text-sage">
          Solo gli amministratori possono gestire i membri dello staff.
        </p>
      </Card>
    </div>
  );

  return (
    <FeatureFlagGate enabled={phase1Enabled} fallback={disabledState}>
      <RoleGate
        currentRole={member.role}
        allowed={["admin"]}
        fallback={notAdminState}
      >
        <StaffPageInner supplierId={member.supplier_id} />
      </RoleGate>
    </FeatureFlagGate>
  );
}

async function StaffPageInner({ supplierId }: { supplierId: string }) {
  const res = await listMembers(supplierId);
  const members = res.ok ? res.data : [];

  const supplierFilter = `supplier_id=eq.${supplierId}`;

  return (
    <>
      <RealtimeRefresh
        subscriptions={[
          { table: "supplier_members", filter: supplierFilter },
        ]}
      />
      <div>
        {/* Mobile hero */}
        <div className="lg:hidden">
          <LargeTitle
            eyebrow="Team fornitore"
            title="Staff"
            subtitle="Membri, ruoli e inviti"
            actions={
              <Link
                href="/supplier/staff/nuovo"
                className="flex h-9 items-center gap-1 rounded-lg bg-[color:var(--color-brand-primary)] px-3 text-[13px] font-semibold text-[color:var(--color-brand-on-primary)] active:opacity-90"
                aria-label="Invita membro"
              >
                <UserPlus className="h-3.5 w-3.5" /> Invita
              </Link>
            }
          />
        </div>

        {/* Desktop header */}
        <div className="hidden lg:flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-3xl text-text-primary">
              Staff<span className="text-brand-primary">.</span>
            </h1>
            <p className="text-sm text-sage mt-1">
              Gestisci i membri del tuo team, i ruoli e gli inviti.
            </p>
          </div>
          <Link href="/supplier/staff/nuovo">
            <Button size="sm">
              <UserPlus className="h-4 w-4" /> Invita membro
            </Button>
          </Link>
        </div>

        {!res.ok ? (
          <Card className="text-center py-16">
            <p className="text-red-600">{res.error}</p>
          </Card>
        ) : (
          <StaffClient supplierId={supplierId} initialMembers={members} />
        )}
      </div>
    </>
  );
}
