import type { Metadata } from "next";
import { BarChart3, Lock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { FCard } from "@/components/fernly/primitives";
import { getCurrentSupplierMember, memberCan } from "@/lib/supplier/current-member";
import { getSupplierAnalytics } from "@/lib/supplier/analytics/queries";
import { isPeriodKey, type PeriodKey } from "@/lib/analytics/period";
import { SupplierAnalyticsContent } from "./analytics-client";

export const metadata: Metadata = { title: "Analytics Fornitore" };

type SearchParams = Promise<{ period?: string }>;

function Blocked({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="px-1 pt-3 lg:px-0 lg:pt-0">
      <PageHeader title="Analytics" subtitle="Fatturato, ordini e clienti nel tempo." />
      <FCard index={0}>
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-[var(--acc-50)] text-[var(--acc-700)]">
            {icon}
          </span>
          <h2 className="f-card-title mt-1">{title}</h2>
          <p className="max-w-[46ch] text-[13px] text-[var(--f-muted)]">{body}</p>
        </div>
      </FCard>
    </div>
  );
}

export default async function SupplierAnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const { period: rawPeriod } = await searchParams;
  const period: PeriodKey = isPeriodKey(rawPeriod) ? rawPeriod : "current";

  const member = await getCurrentSupplierMember();
  if (!member) {
    return (
      <Blocked
        icon={<BarChart3 className="h-5 w-5" aria-hidden />}
        title="Nessun fornitore collegato"
        body="Il tuo account non risulta membro attivo di un fornitore."
      />
    );
  }
  if (!memberCan(member, "analytics.financial")) {
    return (
      <Blocked
        icon={<Lock className="h-5 w-5" aria-hidden />}
        title="Accesso limitato"
        body="Le analytics economiche sono visibili ad amministratori e commerciali."
      />
    );
  }

  const data = await getSupplierAnalytics(member.supplier_id, period);
  return <SupplierAnalyticsContent data={data} />;
}
