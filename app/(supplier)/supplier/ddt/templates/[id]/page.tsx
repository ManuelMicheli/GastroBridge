import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { RoleGate } from "@/components/supplier/shared/role-gate";
import { FeatureFlagGate } from "@/components/supplier/shared/feature-flag-gate";
import { isPhase1Enabled } from "@/lib/supplier/feature-flags";
import { getTemplate } from "@/lib/supplier/ddt/templates-actions";
import { TemplateEditorClient } from "../template-editor-client";
import type { SupplierRole } from "@/types/database";

export const metadata: Metadata = { title: "Modifica template DDT" };

export default async function EditDdtTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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
    .select("id, feature_flags, company_name")
    .eq("id", member.supplier_id)
    .maybeSingle<{
      id: string;
      feature_flags: Record<string, unknown>;
      company_name: string;
    }>();

  const phase1Enabled = isPhase1Enabled(supplier);

  const fallback = (
    <Card className="text-center py-16">
      <p className="text-sage">Non disponibile.</p>
    </Card>
  );

  const res = await getTemplate(id);
  if (!res.ok) {
    return (
      <Card className="text-center py-16">
        <p className="text-red-600">{res.error}</p>
      </Card>
    );
  }

  return (
    <FeatureFlagGate enabled={phase1Enabled} fallback={fallback}>
      <RoleGate
        currentRole={member.role}
        allowed={["admin"]}
        fallback={fallback}
      >
        <TemplateEditorClient
          supplierId={member.supplier_id}
          supplierName={supplier?.company_name ?? "Fornitore"}
          mode="edit"
          initial={res.data}
        />
      </RoleGate>
    </FeatureFlagGate>
  );
}
