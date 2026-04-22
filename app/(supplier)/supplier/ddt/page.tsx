// Task 9 (Plan 1D) — Libro DDT: lista server-side con filtri.
//
// Filtri supportati via searchParams:
//   - q       → ricerca numero o nome destinatario
//   - year    → filtro anno (default: anno corrente)
//   - causale → filtro causale DDT
//   - from    → data inizio (issued_at >=)
//   - to      → data fine (issued_at <=)
//
// La pagina è solo lettura; le azioni (download, ristampa COPIA, annulla)
// sono delegate al client component `DdtBookClient`.
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FileText } from "lucide-react";
import { FeatureFlagGate } from "@/components/supplier/shared/feature-flag-gate";
import { isPhase1Enabled } from "@/lib/supplier/feature-flags";
import { hasPermission } from "@/lib/supplier/permissions";
import type { DdtCausale, SupplierRole } from "@/types/database";
import { DdtBookClient, type DdtBookRow } from "./ddt-book-client";
import { LargeTitle } from "@/components/ui/large-title";

export const metadata: Metadata = { title: "Libro DDT" };

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

function currentYearRome(): number {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
  });
  return Number(fmt.format(new Date()));
}

const VALID_CAUSALI: readonly DdtCausale[] = [
  "sale",
  "consignment",
  "return",
  "transfer",
  "sample",
  "cancel",
] as const;

export default async function SupplierDdtBookPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = firstParam(sp.q).trim();
  const yearParam = firstParam(sp.year).trim();
  const causaleParam = firstParam(sp.causale).trim();
  const fromParam = firstParam(sp.from).trim();
  const toParam = firstParam(sp.to).trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface-card px-6 py-16 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
          Sessione non valida
        </p>
      </div>
    );
  }

  const { data: member } = await supabase
    .from("supplier_members")
    .select("id, role, supplier_id")
    .eq("profile_id", user.id)
    .eq("is_active", true)
    .not("accepted_at", "is", null)
    .limit(1)
    .maybeSingle<{ id: string; role: SupplierRole; supplier_id: string }>();

  if (!member) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface-card px-6 py-16 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
          Nessuna appartenenza attiva
        </p>
      </div>
    );
  }

  if (!hasPermission(member.role, "ddt.generate")) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
              DDT · archivio documenti di trasporto
            </span>
            <span aria-hidden className="h-px flex-1 bg-border-subtle" />
          </div>
          <h1
            className="mt-4 font-display"
            style={{
              fontSize: "var(--text-display-lg)",
              lineHeight: "var(--text-display-lg--line-height)",
              letterSpacing: "var(--text-display-lg--letter-spacing)",
              fontWeight: "var(--text-display-lg--font-weight)",
              color: "var(--color-text-primary)",
            }}
          >
            DDT
          </h1>
        </header>
        <div className="rounded-xl border border-border-subtle bg-surface-card px-6 py-16 text-center">
          <FileText
            className="mx-auto mb-3 h-7 w-7 text-text-tertiary"
            aria-hidden
          />
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
            Accesso non consentito
          </p>
          <p className="mt-2 text-[13px] text-text-secondary">
            Il tuo ruolo non consente l&apos;accesso al libro DDT.
          </p>
        </div>
      </div>
    );
  }

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, feature_flags")
    .eq("id", member.supplier_id)
    .maybeSingle<{ id: string; feature_flags: Record<string, unknown> }>();
  const phase1Enabled = isPhase1Enabled(supplier);

  const notEnabled = (
    <div className="flex flex-col gap-6">
      <header>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
            DDT · archivio documenti di trasporto
          </span>
          <span aria-hidden className="h-px flex-1 bg-border-subtle" />
        </div>
        <h1
          className="mt-4 font-display"
          style={{
            fontSize: "var(--text-display-lg)",
            lineHeight: "var(--text-display-lg--line-height)",
            letterSpacing: "var(--text-display-lg--letter-spacing)",
            fontWeight: "var(--text-display-lg--font-weight)",
            color: "var(--color-text-primary)",
          }}
        >
          DDT
        </h1>
      </header>
      <div className="rounded-xl border border-border-subtle bg-surface-card px-6 py-16 text-center">
        <FileText
          className="mx-auto mb-3 h-7 w-7 text-text-tertiary"
          aria-hidden
        />
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
          Funzione non abilitata per questo account
        </p>
      </div>
    </div>
  );

  const currentYear = currentYearRome();
  const year = yearParam ? Number(yearParam) : currentYear;
  const causale: DdtCausale | null = VALID_CAUSALI.includes(
    causaleParam as DdtCausale,
  )
    ? (causaleParam as DdtCausale)
    : null;

  // Query via admin client (RLS già verificato via appartenenza + permission).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as unknown as { from: (t: string) => any };
  let query = admin
    .from("ddt_documents")
    .select(
      "id, number, year, causale, issued_at, recipient_snapshot, canceled_at, pdf_url, delivery_id",
    )
    .eq("supplier_id", member.supplier_id)
    .order("year", { ascending: false })
    .order("number", { ascending: false })
    .limit(200);

  if (Number.isFinite(year)) query = query.eq("year", year);
  if (causale) query = query.eq("causale", causale);
  if (fromParam) query = query.gte("issued_at", fromParam);
  if (toParam) query = query.lte("issued_at", `${toParam}T23:59:59.999Z`);

  const { data: rowsRaw, error } = await query;
  const allRows = (rowsRaw ?? []) as Array<{
    id: string;
    number: number;
    year: number;
    causale: DdtCausale;
    issued_at: string;
    recipient_snapshot: Record<string, unknown> | null;
    canceled_at: string | null;
    pdf_url: string;
    delivery_id: string;
  }>;

  // Ricerca testuale in memoria (numero esatto / substring nome destinatario).
  const needle = q.toLowerCase();
  const filtered: DdtBookRow[] = allRows
    .filter((r) => {
      if (!needle) return true;
      const numStr = String(r.number);
      const name =
        (r.recipient_snapshot?.name as string | undefined)?.toLowerCase() ?? "";
      return numStr.includes(needle) || name.includes(needle);
    })
    .map((r) => ({
      id: r.id,
      number: r.number,
      year: r.year,
      causale: r.causale,
      issued_at: r.issued_at,
      recipient_name:
        (r.recipient_snapshot?.name as string | undefined) ?? "Destinatario",
      canceled_at: r.canceled_at,
      delivery_id: r.delivery_id,
    }));

  // Anni disponibili nel libro (per dropdown).
  const { data: yearsRaw } = await admin
    .from("ddt_documents")
    .select("year")
    .eq("supplier_id", member.supplier_id);
  const yearsSet = new Set<number>([currentYear]);
  ((yearsRaw ?? []) as Array<{ year: number }>).forEach((y) =>
    yearsSet.add(y.year),
  );
  const years = Array.from(yearsSet).sort((a, b) => b - a);

  const canAdmin = member.role === "admin";

  return (
    <FeatureFlagGate enabled={phase1Enabled} fallback={notEnabled}>
      <div className="space-y-6">
        <div className="lg:hidden">
          <LargeTitle
            eyebrow="Archivio documenti"
            title="DDT"
            subtitle="Documenti di trasporto emessi"
            actions={
              <Link
                href="/supplier/ddt/templates"
                className="text-[12px] font-semibold text-[color:var(--color-brand-primary)]"
              >
                Template →
              </Link>
            }
          />
        </div>
        <div className="hidden lg:block">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
              DDT · archivio · documenti di trasporto emessi
            </span>
            <span aria-hidden className="h-px flex-1 bg-border-subtle" />
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
              <span className="tabular-nums text-text-primary">
                {filtered.length}
              </span>{" "}
              in lista
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
                DDT
              </h1>
              <p className="mt-1.5 text-sm text-text-secondary">
                Archivio dei documenti di trasporto emessi. Filtra per anno,
                causale e destinatario.
              </p>
            </div>
            <Link
              href="/supplier/ddt/templates"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-card px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-text-secondary transition-colors hover:border-accent-green/50 hover:text-text-primary"
            >
              Gestisci template →
            </Link>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-accent-red/40 bg-accent-red/5 px-4 py-10 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent-red">
              Errore caricamento: {error.message}
            </p>
          </div>
        ) : (
          <DdtBookClient
            initialRows={filtered}
            years={years}
            filters={{
              q,
              year,
              causale,
              from: fromParam,
              to: toParam,
            }}
            canAdmin={canAdmin}
          />
        )}
      </div>
    </FeatureFlagGate>
  );
}
