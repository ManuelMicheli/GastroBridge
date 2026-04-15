import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { acceptInvite } from "@/lib/supplier/staff/actions";
import { AutoRedirect } from "./auto-redirect";
import type { SupplierRole } from "@/types/database";

export const metadata: Metadata = { title: "Accetta invito" };

const ROLE_LABEL: Record<SupplierRole, string> = {
  admin: "Admin",
  sales: "Sales",
  warehouse: "Magazzino",
  driver: "Driver",
};

export default async function AcceptSupplierInvitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirect=/supplier/invito/accetta");
  }

  const meta = (user.user_metadata ?? {}) as {
    supplier_id?: string;
    role?: SupplierRole;
    invited_by?: string;
  };

  const supplierId = meta.supplier_id;

  if (!supplierId) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <Card className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-terracotta mx-auto mb-4" />
          <h1 className="text-xl font-bold text-charcoal mb-2">
            Invito non valido
          </h1>
          <p className="text-sage mb-6">
            Non troviamo i dati dell&apos;invito. Chiedi all&apos;amministratore
            di inviare un nuovo invito.
          </p>
          <Link href="/supplier/dashboard">
            <Button size="sm" variant="secondary">
              Vai alla dashboard
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const result = await acceptInvite(supplierId);

  if (!result.ok) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <Card className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-terracotta mx-auto mb-4" />
          <h1 className="text-xl font-bold text-charcoal mb-2">
            Impossibile accettare l&apos;invito
          </h1>
          <p className="text-sage mb-6">{result.error}</p>
          <Link href="/supplier/dashboard">
            <Button size="sm" variant="secondary">
              Vai alla dashboard
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("company_name")
    .eq("id", supplierId)
    .maybeSingle<{ company_name: string }>();

  const roleLabel = ROLE_LABEL[result.data.role as SupplierRole] ?? result.data.role;
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
        <Link href="/supplier/dashboard">
          <Button size="sm">Vai subito alla dashboard</Button>
        </Link>
      </Card>
    </div>
  );
}
