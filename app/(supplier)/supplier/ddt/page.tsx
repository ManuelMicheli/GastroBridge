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
import { Card } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { FeatureFlagGate } from "@/components/supplier/shared/feature-flag-gate";
import { isPhase1Enabled } from "@/lib/supplier/feature-flags";
import { hasPermission } from "@/lib/supplier/permissions";
import type { DdtCausale, SupplierRole } from "@/types/database";
import { DdtBookClient, type DdtBookRow } from "./ddt-book-client";

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
      <Card className="py-16 text-center">
        <p className="text-sage">Sessione non valida.</p>
      </Card>
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
      <Card className="py-16 text-center">
        <p className="text-sage">Nessuna appartenenza attiva.</p>
      </Card>
    );
  }

  if (!hasPermission(member.role, "ddt.generate")) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-charcoal">Libro DDT</h1>
        <Card className="py-16 text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 text-sage-muted" />
          <p className="text-sage">
            Il tuo ruolo non consente l&apos;accesso al libro DDT.
          </p>
        </Card>
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
    <div>
      <h1 className="mb-6 text-2xl font-bold text-charcoal">Libro DDT</h1>
      <Card className="py-16 text-center">
        <FileText className="mx-auto mb-4 h-12 w-12 text-sage-muted" />
        <p className="text-sage">Funzione non abilitata per questo account.</p>
      </Card>
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
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-charcoal">Libro DDT</h1>
            <p className="mt-1 text-sm text-sage">
              Archivio dei Documenti di Trasporto emessi.
            </p>
          </div>
          <Link
            href="/supplier/ddt/templates"
            className="text-sm font-semibold text-forest hover:underline"
          >
            Gestisci template →
          </Link>
        </div>

        {error ? (
          <Card className="py-16 text-center">
            <p className="text-red-600">Errore caricamento: {error.message}</p>
          </Card>
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
