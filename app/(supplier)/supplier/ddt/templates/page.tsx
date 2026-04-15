import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RoleGate } from "@/components/supplier/shared/role-gate";
import { FeatureFlagGate } from "@/components/supplier/shared/feature-flag-gate";
import { isPhase1Enabled } from "@/lib/supplier/feature-flags";
import { listTemplates } from "@/lib/supplier/ddt/templates-actions";
import { TemplatesListClient } from "./templates-list-client";
import type { SupplierRole } from "@/types/database";
import { FileText, Plus } from "lucide-react";

export const metadata: Metadata = { title: "Template DDT" };

export default async function SupplierDdtTemplatesPage() {
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

  const notEnabled = (
    <div>
      <h1 className="text-2xl font-bold text-charcoal mb-6">Template DDT</h1>
      <Card className="text-center py-16">
        <FileText className="h-12 w-12 text-sage-muted mx-auto mb-4" />
        <p className="text-sage">
          I template DDT non sono abilitati per questo account.
        </p>
      </Card>
    </div>
  );

  const notAdmin = (
    <div>
      <h1 className="text-2xl font-bold text-charcoal mb-6">Template DDT</h1>
      <Card className="text-center py-16">
        <FileText className="h-12 w-12 text-sage-muted mx-auto mb-4" />
        <p className="text-sage">
          Solo gli amministratori possono gestire i template DDT.
        </p>
      </Card>
    </div>
  );

  return (
    <FeatureFlagGate enabled={phase1Enabled} fallback={notEnabled}>
      <RoleGate
        currentRole={member.role}
        allowed={["admin"]}
        fallback={notAdmin}
      >
        <Inner supplierId={member.supplier_id} />
      </RoleGate>
    </FeatureFlagGate>
  );
}

async function Inner({ supplierId }: { supplierId: string }) {
  const res = await listTemplates(supplierId);
  const templates = res.ok ? res.data : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Template DDT</h1>
          <p className="text-sm text-sage mt-1">
            Personalizza logo, colori e testi dei Documenti di Trasporto.
          </p>
        </div>
        <Link href="/supplier/ddt/templates/nuovo">
          <Button size="sm">
            <Plus className="h-4 w-4" /> Nuovo template
          </Button>
        </Link>
      </div>

      {!res.ok ? (
        <Card className="text-center py-16">
          <p className="text-red-600">{res.error}</p>
        </Card>
      ) : (
        <TemplatesListClient
          supplierId={supplierId}
          initialTemplates={templates}
        />
      )}
    </div>
  );
}
