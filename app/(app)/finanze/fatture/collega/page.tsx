import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getFinanceAccess } from "@/lib/invoices/server/access";
import { activeProvider } from "@/lib/invoices/providers/registry";
import { companyDefaults, getConnection } from "@/lib/invoices/server/sdi";
import { NoFinanceAccess } from "../../_components/finance-bits";
import { ConnectWizard } from "./connect-wizard";

export const metadata: Metadata = { title: "Collega le fatture elettroniche" };

export default async function ConnectInvoicesPage() {
  const access = await getFinanceAccess("read");
  if (!access.ok) return <NoFinanceAccess message={access.error} />;
  const { db, ctx, canWrite } = access;
  const provider = activeProvider();
  const st = provider.status();
  const [defaults, connection] = await Promise.all([
    companyDefaults(ctx.restaurantId).catch(() => ({ fiscalId: null, companyName: null, email: null })),
    getConnection(db, ctx.restaurantId).catch(() => null),
  ]);
  return (
    <div className="px-1 lg:px-0">
      <div className="mb-3 flex items-center gap-2">
        <Link href="/finanze/fatture" className="f-icon-btn !h-9 !w-9" aria-label="Torna alle fatture">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-[13px] text-[var(--f-muted)]">Fatture fornitori</span>
      </div>
      <ConnectWizard
        canWrite={canWrite}
        provider={{
          configured: st.configured,
          label: provider.label,
          sandbox: st.environment === "sandbox",
          missing: st.missing,
          recipientCode: provider.recipientCode(),
        }}
        defaults={{
          fiscalId: defaults.fiscalId ?? "",
          companyName: defaults.companyName ?? ctx.restaurantName,
          email: defaults.email ?? "",
        }}
        connection={
          connection
            ? {
                status: connection.status,
                fiscalId: connection.fiscal_id,
                companyName: connection.company_name,
                recipientCode: connection.recipient_code,
                portalConfirmedAt: connection.portal_confirmed_at,
                lastInvoiceAt: connection.last_invoice_at,
                lastError: connection.last_error,
              }
            : null
        }
        restaurantName={ctx.restaurantName}
      />
    </div>
  );
}
