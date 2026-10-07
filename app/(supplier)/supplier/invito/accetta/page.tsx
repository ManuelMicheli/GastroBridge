import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { acceptInvite } from "@/lib/supplier/staff/actions";
import { AutoRedirect } from "./auto-redirect";
import type { SupplierRole } from "@/types/database";
import { ROLE_LABELS } from "@/lib/supplier/permissions";

export const metadata: Metadata = { title: "Accetta invito" };


export default async function AcceptSupplierInvitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/supplier/invito/accetta");
  }

  // New invitees carry the supplier in their signup metadata; users who
  // already had an account are matched on their pending membership.
  const meta = (user.user_metadata ?? {}) as { invited_supplier_id?: string };
  const result = await acceptInvite(meta.invited_supplier_id ?? null);

  if (!result.ok) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <Card className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-terracotta mx-auto mb-4" />
          <h1 className="text-xl font-bold text-charcoal mb-2">
            Impossibile accettare l&apos;invito
          </h1>
          <p className="text-sage mb-6">{result.error}</p>
          <ButtonLink href="/supplier/dashboard" size="sm" variant="secondary">
              Vai alla dashboard
            </ButtonLink>
        </Card>
      </div>
    );
  }

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("company_name")
    .eq("id", result.data.supplier_id)
    .maybeSingle<{ company_name: string }>();

  const roleLabel = ROLE_LABELS[result.data.role as SupplierRole] ?? result.data.role;
  const supplierName = supplier?.company_name ?? "il tuo team";

  return (
    <div className="max-w-xl mx-auto py-12">
      <AutoRedirect to="/supplier/dashboard" delayMs={2000} />
      <Card className="text-center py-12">
        <CheckCircle2 className="h-12 w-12 text-accent-green mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-charcoal mb-2">
          Benvenuto in {supplierName}
        </h1>
        <p className="text-sage mb-6">
          Il tuo ruolo è <strong className="text-charcoal">{roleLabel}</strong>
          . Verrai reindirizzato alla dashboard…
        </p>
        <ButtonLink href="/supplier/dashboard" size="sm">Vai subito alla dashboard</ButtonLink>
      </Card>
    </div>
  );
}
