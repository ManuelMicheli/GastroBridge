"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Brain, CheckCircle2, GitMerge, PlusCircle, RefreshCw, Settings2, Store } from "lucide-react";
import { cn } from "@/lib/utils/formatters";
import { commitRestaurantImport } from "@/lib/import/server/actions";
import type { CatalogSnapshot, RestaurantContextPayload } from "@/lib/import/api-types";
import type { ExtractionResult } from "@/lib/import/types";
import { toCatalogItem, supplierNotes } from "@/lib/import/catalog-mapping";
import { diffPriceLists } from "@/lib/import/match/diff";
import { CatalogImportWizard } from "@/components/dashboard/restaurant/catalog-import-wizard";
import { CatalogFormDialog } from "@/components/dashboard/restaurant/catalog-form-dialog";
import { InviteSupplierButton } from "@/app/(app)/fornitori/cerca/invite-button";
import { ImportProgress, SmartDropzone } from "./smart-dropzone";
import { ProductReview, WarningsList, type RowAnnotation } from "./product-review";
import { SupplierInfoCard, type SupplierForm } from "./supplier-info-card";
import { ColumnsPanel } from "./columns-panel";
import { needsReview, toCorrections, toReviewItems, unitPriceOf, type ReviewItem } from "./review-model";
import { useSmartImport } from "./use-smart-import";

type Target = { kind: "new" } | { kind: "existing"; catalogId: string; removeMissing: boolean };

function supplierFormFrom(r: ExtractionResult): SupplierForm {
  const s = r.supplier;
  return {
    name: s.name ?? "",
    vatNumber: s.vatNumber ?? "",
    phones: s.phones.join(", "),
    emails: [...s.emails, ...(s.pec ? [s.pec] : [])].join(", "),
    address: [s.address, [s.zip, s.city].filter(Boolean).join(" "), s.province ? `(${s.province})` : null].filter(Boolean).join(", "),
    deliveryDays: s.deliveryDays,
    minOrder: s.minOrder != null ? String(s.minOrder).replace(".", ",") : "",
    leadTimeDays: s.leadTimeDays != null ? String(s.leadTimeDays) : "",
    notes: supplierNotes(s),
  };
}

function num(s: string): number | null {
  const t = s.replace(/[€\s]/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * "Aggiungi fornitore" smart flow for restaurants: drop or paste anything →
 * live progress → review by cards (supplier, products by category, price
 * changes vs an existing list) → save as a restaurant catalog.
 */
export function RestaurantSmartImport({
  targetCatalogId = null,
  targetCatalogName = null,
}: {
  targetCatalogId?: string | null;
  targetCatalogName?: string | null;
}) {
  const router = useRouter();
  const { state, analyzeFile, analyzeText, reanalyze, reset } = useSmartImport("restaurant", { targetCatalogId });
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [supplier, setSupplier] = useState<SupplierForm | null>(null);
  const [target, setTarget] = useState<Target>({ kind: "new" });
  const [linkPlatform, setLinkPlatform] = useState(false);
  const [usedOverrides, setUsedOverrides] = useState(false);
  const [saving, startSaving] = useTransition();
  const [done, setDone] = useState<{ catalogId: string; inserted: number; updated: number; removed: number; unchanged: number; learned: number } | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const result = state.result;
  const ctx = state.context?.persona === "restaurant" ? (state.context as RestaurantContextPayload) : null;

  // New result → fresh review state.
  useEffect(() => {
    if (!result) return;
    setItems(toReviewItems(result.products));
    setSupplier(supplierFormFrom(result));
    const best = ctx?.candidates[0];
    if (ctx?.target) setTarget({ kind: "existing", catalogId: ctx.target.id, removeMissing: false });
    else if (best && best.score >= 0.9) setTarget({ kind: "existing", catalogId: best.catalogId, removeMissing: false });
    else setTarget({ kind: "new" });
    setLinkPlatform(Boolean(ctx?.platformSupplier && ctx.platformEnabled));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const snapshots = useMemo(() => {
    const m = new Map<string, CatalogSnapshot>();
    if (ctx?.target) m.set(ctx.target.id, ctx.target);
    for (const c of ctx?.candidates ?? []) m.set(c.catalogId, c.catalog);
    return m;
  }, [ctx]);

  const catalogItems = useMemo(
    () =>
      items
        .filter((i) => i.included && i.price !== null && i.price > 0)
        .map((i) => ({ id: i.id, ...toCatalogItem({ ...i, unitPrice: unitPriceOf(i) }) })),
    [items],
  );

  const existing = target.kind === "existing" ? snapshots.get(target.catalogId) ?? null : null;
  const diff = useMemo(() => {
    if (!existing) return null;
    return diffPriceLists(existing.items, catalogItems.map((c) => ({ key: c.id, name: c.product_name, unit: c.unit, price: c.price })));
  }, [existing, catalogItems]);

  const annotations = useMemo(() => {
    if (!diff) return undefined;
    const a: Record<string, RowAnnotation> = {};
    for (const e of diff.entries) {
      if (!e.incoming) continue;
      a[e.incoming.key] = {
        kind: e.kind === "removed" ? "unchanged" : e.kind,
        delta: e.delta,
        pct: e.pct,
        existingName: e.existing?.name,
        existingPrice: e.existing?.price,
      };
    }
    return a;
  }, [diff]);

  const reviewLeft = items.filter((i) => i.included && needsReview(i)).length;
  const busy = state.phase === "reading" || state.phase === "analyzing";

  const save = () => {
    if (!result || !supplier) return;
    if (!supplier.name.trim()) {
      toast.error("Indica il nome del fornitore");
      return;
    }
    if (catalogItems.length === 0) {
      toast.error("Nessun prodotto incluso con un prezzo");
      return;
    }
    // one row per name+unit (two sizes with the same name stay distinct via the format in the name)
    const seen = new Set<string>();
    const rows = catalogItems.filter((c) => {
      const k = `${c.product_name.toLowerCase()}|${c.unit}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const vat = supplier.vatNumber.replace(/\D/g, "");
    startSaving(async () => {
      const res = await commitRestaurantImport({
        target,
        supplier: {
          name: supplier.name.trim(),
          vatNumber: vat.length === 11 ? vat : null,
          leadTimeDays: supplier.leadTimeDays ? Math.round(num(supplier.leadTimeDays) ?? 0) : null,
          minOrder: num(supplier.minOrder),
          notes: supplier.notes.trim() || null,
          deliveryDays: supplier.deliveryDays,
          emails: supplier.emails.split(/[,;\s]+/).filter((e) => e.includes("@")).slice(0, 5),
          phones: supplier.phones.split(/[,;]+/).map((p) => p.trim()).filter(Boolean).slice(0, 5),
          address: supplier.address.trim() || null,
        },
        items: rows.map(({ product_name, unit, price, notes }) => ({ product_name, unit, price, notes })),
        linkSupplierId: linkPlatform && ctx?.platformSupplier ? ctx.platformSupplier.id : null,
        learning: { corrections: toCorrections(items), layouts: usedOverrides ? result.layouts.map((l) => ({ signature: l.signature, roles: Object.fromEntries(Object.entries(l.roles)) })) : [] },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDone(res.data);
      toast.success(target.kind === "existing" ? "Listino aggiornato" : `“${supplier.name.trim()}” aggiunto ai fornitori`);
      router.refresh();
    });
  };

  // ---------------------------------------------------------------- render
  if (done) {
    return (
      <div className="f-card f-rise mx-auto flex max-w-xl flex-col items-center gap-3 px-6 py-12 text-center">
        <CheckCircle2 className="h-12 w-12 text-[var(--f-success)]" />
        <h2 className="text-[20px] font-semibold text-[var(--f-ink)]">Fatto!</h2>
        <p className="text-[14px] text-[var(--f-muted)]">
          {done.inserted} nuovi prodotti
          {done.updated ? ` · ${done.updated} prezzi aggiornati` : ""}
          {done.unchanged ? ` · ${done.unchanged} invariati` : ""}
          {done.removed ? ` · ${done.removed} rimossi` : ""}
        </p>
        {done.learned > 0 ? (
          <p className="flex items-center gap-1.5 text-[13px] text-[var(--acc-700)]">
            <Brain className="h-4 w-4" /> Abbiamo imparato {done.learned} correzioni: il prossimo listino di questo fornitore sarà più veloce.
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Link href={`/cataloghi/${done.catalogId}`} className="f-btn f-btn-primary">Apri il listino</Link>
          <button type="button" className="f-btn f-btn-outline" onClick={() => { setDone(null); reset(); }}>
            Importa un altro fornitore
          </button>
        </div>
      </div>
    );
  }

  if (state.phase === "idle" || state.phase === "error") {
    return (
      <div className="flex flex-col gap-4">
        {targetCatalogName ? (
          <div className="f-card flex items-center gap-3 px-5 py-3.5 text-[14px] text-[var(--f-ink-2)]">
            <RefreshCw className="h-4 w-4 text-[var(--acc-700)]" /> Aggiorni il listino di <strong>{targetCatalogName}</strong>: ti mostreremo cosa cambia prima di salvare.
          </div>
        ) : null}
        {state.phase === "error" && state.error ? <WarningsList warnings={[state.error]} /> : null}
        <SmartDropzone onFile={analyzeFile} onText={analyzeText} />
        <AdvancedFallback targetCatalogId={targetCatalogId} open={advancedOpen} setOpen={setAdvancedOpen} />
      </div>
    );
  }

  if (busy || !result || !supplier) {
    return <ImportProgress progress={state.progress} message={state.message} label={state.sourceLabel} />;
  }

  const includedCount = catalogItems.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={reset} className="f-btn f-btn-ghost f-btn-sm">
          <ArrowLeft className="h-4 w-4" /> Ricomincia
        </button>
        <p className="text-[13px] text-[var(--f-muted)]">
          {state.sourceLabel ? <>Da «{state.sourceLabel}» · </> : null}
          {result.products.length} prodotti riconosciuti
          {state.memoryUsed ? (
            <span className="ml-2 inline-flex items-center gap-1 text-[var(--acc-700)]"><Brain className="h-3.5 w-3.5" /> con le tue correzioni precedenti</span>
          ) : null}
        </p>
      </div>

      <WarningsList warnings={result.warnings} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SupplierInfoCard value={supplier} onChange={setSupplier} confidence={result.supplier.confidence} />
        <TargetCard
          ctx={ctx}
          target={target}
          setTarget={setTarget}
          counts={diff?.counts ?? null}
          linkPlatform={linkPlatform}
          setLinkPlatform={setLinkPlatform}
        />
      </div>

      <ColumnsPanel
        result={result}
        busy={busy}
        onApply={(o) => {
          setUsedOverrides(true);
          void reanalyze(o);
        }}
      />

      <ProductReview items={items} onChange={setItems} annotations={annotations} />

      <div className="f-card sticky bottom-3 z-20 px-4 py-3 shadow-[0_12px_32px_rgba(16,24,20,0.12)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-[var(--f-muted)]">
            <strong className="text-[var(--f-ink)]">{includedCount}</strong> prodotti da salvare
            {reviewLeft > 0 ? <span className="ml-2 text-[var(--f-warning)]">· {reviewLeft} da controllare</span> : null}
          </p>
          <button type="button" className="f-btn f-btn-primary" disabled={saving || includedCount === 0} onClick={save}>
            {saving ? "Salvataggio…" : target.kind === "existing" ? "Aggiorna listino" : "Aggiungi fornitore"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TargetCard({
  ctx,
  target,
  setTarget,
  counts,
  linkPlatform,
  setLinkPlatform,
}: {
  ctx: RestaurantContextPayload | null;
  target: Target;
  setTarget: (t: Target) => void;
  counts: Record<"new" | "increased" | "decreased" | "unchanged" | "removed", number> | null;
  linkPlatform: boolean;
  setLinkPlatform: (v: boolean) => void;
}) {
  const candidates = ctx?.candidates ?? [];
  const others = (ctx?.catalogs ?? []).filter((c) => !candidates.some((x) => x.catalogId === c.id) && c.id !== ctx?.target?.id);
  const option = (active: boolean) =>
    cn(
      "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
      active ? "border-[var(--acc-600)] bg-[var(--acc-50)]" : "border-[var(--f-line)] hover:bg-[var(--f-fill)]",
    );

  return (
    <section className="f-card flex flex-col gap-3 p-5 sm:px-[22px]" aria-label="Dove salvare">
      <h2 className="f-card-title">Dove lo salviamo?</h2>

      {ctx?.target ? (
        <button type="button" className={option(target.kind === "existing" && target.catalogId === ctx.target.id)} onClick={() => setTarget({ kind: "existing", catalogId: ctx.target!.id, removeMissing: false })}>
          <GitMerge className="mt-0.5 h-4 w-4 shrink-0 text-[var(--acc-700)]" />
          <span>
            <span className="block text-[14px] font-medium text-[var(--f-ink)]">Aggiorna «{ctx.target.supplier_name}»</span>
            <span className="text-[12.5px] text-[var(--f-muted)]">{ctx.target.items.length} prodotti nel listino attuale</span>
          </span>
        </button>
      ) : null}

      {candidates.map((c) => (
        <button key={c.catalogId} type="button" className={option(target.kind === "existing" && target.catalogId === c.catalogId)} onClick={() => setTarget({ kind: "existing", catalogId: c.catalogId, removeMissing: false })}>
          <GitMerge className="mt-0.5 h-4 w-4 shrink-0 text-[var(--acc-700)]" />
          <span>
            <span className="block text-[14px] font-medium text-[var(--f-ink)]">Aggiorna listino esistente «{c.supplierName}»</span>
            <span className="text-[12.5px] text-[var(--f-muted)]">{c.reason} · {c.catalog.items.length} prodotti</span>
          </span>
        </button>
      ))}

      <button type="button" className={option(target.kind === "new")} onClick={() => setTarget({ kind: "new" })}>
        <PlusCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--acc-700)]" />
        <span>
          <span className="block text-[14px] font-medium text-[var(--f-ink)]">Nuovo fornitore</span>
          <span className="text-[12.5px] text-[var(--f-muted)]">Crea un nuovo listino con questi prodotti</span>
        </span>
      </button>

      {others.length > 0 ? (
        <label className="block">
          <span className="f-label">…oppure aggiorna un altro fornitore</span>
          <select
            className="f-input mt-1 h-10"
            value={target.kind === "existing" && others.some((o) => o.id === target.catalogId) ? target.catalogId : ""}
            onChange={(e) => (e.target.value ? setTarget({ kind: "existing", catalogId: e.target.value, removeMissing: false }) : setTarget({ kind: "new" }))}
          >
            <option value="">—</option>
            {others.map((o) => (
              <option key={o.id} value={o.id}>{o.supplier_name} ({o.items})</option>
            ))}
          </select>
        </label>
      ) : null}

      {target.kind === "existing" ? (
        counts ? (
          <div className="rounded-xl bg-[var(--f-fill)] p-3">
            <p className="mb-2 text-[13px] font-medium text-[var(--f-ink)]">Cosa cambia nel listino</p>
            <div className="flex flex-wrap gap-1.5 text-[12.5px]">
              <span className="f-tag bg-[var(--f-danger-bg)] text-[var(--f-danger)]">↑ {counts.increased} aumenti</span>
              <span className="f-tag bg-[var(--f-success-bg)] text-[var(--f-success)]">↓ {counts.decreased} ribassi</span>
              <span className="f-tag bg-[var(--f-info-bg)] text-[var(--f-info)]">+ {counts.new} nuovi</span>
              <span className="f-tag bg-[var(--f-card)] text-[var(--f-muted)]">= {counts.unchanged} invariati</span>
              <span className="f-tag bg-[var(--f-card)] text-[var(--f-muted)]">− {counts.removed} non più presenti</span>
            </div>
            {counts.removed > 0 ? (
              <label className="mt-3 flex items-center gap-2 text-[13px] text-[var(--f-ink-2)]">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--acc-700)]"
                  checked={target.removeMissing}
                  onChange={(e) => setTarget({ ...target, removeMissing: e.target.checked })}
                />
                Rimuovi i {counts.removed} prodotti non più a listino
              </label>
            ) : null}
          </div>
        ) : (
          <p className="text-[12.5px] text-[var(--f-muted)]">Prezzi aggiornati e nuovi prodotti verranno uniti al listino; i prodotti mancanti restano.</p>
        )
      ) : null}

      {ctx?.platformSupplier && ctx.platformEnabled ? (
        <div className="rounded-xl border border-[var(--f-line)] p-3">
          <p className="flex items-center gap-2 text-[13.5px] font-medium text-[var(--f-ink)]">
            <Store className="h-4 w-4 text-[var(--acc-700)]" /> {ctx.platformSupplier.company_name} è su GastroBridge
          </p>
          <p className="mt-0.5 text-[12.5px] text-[var(--f-muted)]">
            {ctx.platformSupplier.reason}
            {ctx.platformSupplier.city ? ` · ${ctx.platformSupplier.city}` : ""}. Collegati per ordinare direttamente e ricevere i listini aggiornati.
          </p>
          <label className="mt-2 flex items-center gap-2 text-[13px] text-[var(--f-ink-2)]">
            <input type="checkbox" className="h-4 w-4 accent-[var(--acc-700)]" checked={linkPlatform} onChange={(e) => setLinkPlatform(e.target.checked)} />
            Collega questo listino al fornitore
          </label>
          <div className="mt-2">
            <InviteSupplierButton supplierId={ctx.platformSupplier.id} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AdvancedFallback({
  targetCatalogId,
  open,
  setOpen,
}: {
  targetCatalogId: string | null;
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const router = useRouter();
  return (
    <details className="text-[13px] text-[var(--f-muted)]">
      <summary className="inline-flex cursor-pointer items-center gap-1.5 hover:text-[var(--f-ink)]">
        <Settings2 className="h-4 w-4" /> Avanzato
      </summary>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {targetCatalogId ? (
          <>
            <span>Preferisci scegliere tu le colonne di un Excel/CSV?</span>
            <button type="button" className="f-btn f-btn-outline f-btn-sm" onClick={() => setOpen(true)}>Import con mappatura colonne</button>
            <CatalogImportWizard open={open} onClose={() => setOpen(false)} catalogId={targetCatalogId} onImported={() => router.push(`/cataloghi/${targetCatalogId}`)} />
          </>
        ) : (
          <>
            <span>Preferisci inserire il fornitore a mano?</span>
            <button type="button" className="f-btn f-btn-outline f-btn-sm" onClick={() => setOpen(true)}>Crea a mano</button>
            <CatalogFormDialog open={open} onClose={() => setOpen(false)} onSaved={(c) => (c ? router.push(`/cataloghi/${c.id}`) : router.refresh())} />
          </>
        )}
      </div>
    </details>
  );
}

