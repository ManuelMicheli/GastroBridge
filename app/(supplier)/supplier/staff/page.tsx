import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RoleGate } from "@/components/supplier/shared/role-gate";
import { FeatureFlagGate } from "@/components/supplier/shared/feature-flag-gate";
import { isPhase1Enabled } from "@/lib/supplier/feature-flags";
import { listMembers } from "@/lib/supplier/staff/actions";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { StaffClient } from "./staff-client";
import type { SupplierRole } from "@/types/database";
import { UserPlus, Users } from "lucide-react";
import { LargeTitle } from "@/components/ui/large-title";
import { SectionFrame } from "@/components/dashboard/supplier/_awwwards/section-frame";

export const metadata: Metadata = { title: "Staff" };

function TerminalEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
          Staff · team fornitore
        </span>
        <span aria-hidden className="h-px flex-1 bg-border-subtle" />
      </header>
      <h1
        className="font-display"
        style={{
          fontSize: "var(--text-display-lg)",
          lineHeight: "var(--text-display-lg--line-height)",
          letterSpacing: "var(--text-display-lg--letter-spacing)",
          fontWeight: "var(--text-display-lg--font-weight)",
          color: "var(--color-text-primary)",
        }}
      >
        Staff
      </h1>
      <div className="rounded-xl border border-border-subtle bg-surface-card px-6 py-16 text-center">
        <Users className="mx-auto mb-3 h-7 w-7 text-text-tertiary" aria-hidden />
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
          {title}
        </p>
        <p className="mt-2 text-[13px] text-text-secondary">{body}</p>
      </div>
    </div>
  );
}

export default async function SupplierStaffPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <TerminalEmpty
        title="Sessione non valida"
        body="Accedi nuovamente per gestire lo staff."
      />
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
      <TerminalEmpty
        title="Appartenenza non attiva"
        body="Nessuna appartenenza attiva — contatta l'amministratore."
      />
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
    <TerminalEmpty
      title="Feature non abilitata"
      body="La gestione dello staff non è abilitata per questo account."
    />
  );

  const notAdminState = (
    <TerminalEmpty
      title="Accesso limitato"
      body="Solo gli amministratori possono gestire i membri dello staff."
    />
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
  const activeCount = members.filter((m) => m.is_active).length;

  const supplierFilter = `supplier_id=eq.${supplierId}`;

  return (
    <>
      <RealtimeRefresh
        subscriptions={[{ table: "supplier_members", filter: supplierFilter }]}
      />

      {/* Mobile */}
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
        {res.ok ? (
          <StaffClient supplierId={supplierId} initialMembers={members} />
        ) : (
          <div className="mt-4 rounded-xl border border-accent-red/40 bg-accent-red/10 px-4 py-6 text-center">
            <p className="text-[13px] text-accent-red">{res.error}</p>
          </div>
        )}
      </div>

      {/* Desktop — terminal team console */}
      <div className="hidden lg:block">
        <div className="flex flex-col gap-6">
          <header>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
                Staff · team fornitore · ruoli e permessi
              </span>
              <span aria-hidden className="h-px flex-1 bg-border-subtle" />
              <span className="inline-flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
                <span className="tabular-nums text-text-primary">
                  {members.length}
                </span>
                <span>totali</span>
                <span aria-hidden>·</span>
                <span className="tabular-nums text-accent-green">
                  {activeCount}
                </span>
                <span>attivi</span>
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1
                  className="font-display"
                  style={{
                    fontSize: "var(--text-display-lg)",
                    lineHeight: "var(--text-display-lg--line-height)",
                    letterSpacing: "var(--text-display-lg--letter-spacing)",
                    fontWeight: "var(--text-display-lg--font-weight)",
                    color: "var(--color-text-primary)",
                  }}
                >
                  Staff
                </h1>
                <p className="mt-1.5 text-sm text-text-secondary">
                  Gestisci i membri del tuo team, i ruoli e gli inviti.
                </p>
              </div>
              <Link
                href="/supplier/staff/nuovo"
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent-green/40 bg-accent-green/10 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-green transition-colors hover:bg-accent-green/20"
              >
                <UserPlus className="h-3.5 w-3.5" aria-hidden /> Invita membro
              </Link>
            </div>
          </header>

          <SectionFrame
            label={`Membri · ${members.length}`}
            trailing={activeCount === members.length ? "tutti attivi" : undefined}
            padded={false}
          >
            {!res.ok ? (
              <div className="px-4 py-10 text-center">
                <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent-red">
                  {res.error}
                </p>
              </div>
            ) : (
              <div className="p-4">
                <StaffClient
                  supplierId={supplierId}
                  initialMembers={members}
                />
              </div>
            )}
          </SectionFrame>
        </div>
      </div>
    </>
  );
}
