"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Brain, CheckCircle2, ListChecks } from "lucide-react";
import { commitSupplierImport } from "@/lib/import/server/actions";
import type { SupplierContextPayload, SupplierProductSnapshot } from "@/lib/import/api-types";
import { platformCategorySlug, toMacro } from "@/lib/import/lexicon/categories";
import { toProductUnit, toSalesUnitType, saleUnitLabel } from "@/lib/import/catalog-mapping";
import { NameIndex } from "@/lib/import/match/similarity";
import { nameKey } from "@/lib/import/text";
import { ImportProgress, SmartDropzone } from "./smart-dropzone";
import { ProductReview, WarningsList, type RowAnnotation } from "./product-review";
import { ColumnsPanel } from "./columns-panel";
import { needsReview, toCorrections, toReviewItems, type ReviewItem } from "./review-model";
import { useSmartImport } from "./use-smart-import";

type Match = { item: ReviewItem; product: SupplierProductSnapshot | null; how: "code" | "name" | "fuzzy" | null };

function monthLabel(): string {
  return new Date().toLocaleDateString("it-IT", { month: "long", year: "numeric" });
}

/**
 * Supplier catalog smart import: drop your own price list (PDF, Excel, photo,
 * text) → review by cards → update prices / availability of existing
 * products, create the new ones, optionally save a named price list.
 */
export function SupplierSmartImport({ advanced }: { advanced?: ReactNode }) {
  const router = useRouter();
  const { state, analyzeFile, analyzeText, reanalyze, reset } = useSmartImport("supplier");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [deactivateMissing, setDeactivateMissing] = useState(false);
  const [saveList, setSaveList] = useState(false);
  const [listChoice, setListChoice] = useState<string>("new");
  const [listName, setListName] = useState(`Listino ${monthLabel()}`);
  const [fallbackCategory, setFallbackCategory] = useState<string>("");
  const [usedOverrides, setUsedOverrides] = useState(false);
  const [saving, startSaving] = useTransition();
  const [done, setDone] = useState<{ created: number; updated: number; deactivated: number; priceListItems: number; learned: number; warnings: string[] } | null>(null);

  const result = state.result;
  const ctx = state.context?.persona === "supplier" ? (state.context as SupplierContextPayload) : null;

  useEffect(() => {
    if (!result) return;
    setItems(toReviewItems(result.products));
  }, [result]);

  useEffect(() => {
    if (ctx && !fallbackCategory) {
      setFallbackCategory(ctx.categories.find((c) => c.slug === "food-secco")?.id ?? ctx.categories[0]?.id ?? "");
    }
  }, [ctx, fallbackCategory]);

  // ---- match every row with the existing catalog -----------------------------
  const matches: Match[] = useMemo(() => {
    const products = ctx?.products ?? [];
    const bySku = new Map(products.filter((p) => p.sku).map((p) => [p.sku!.toLowerCase(), p]));
    const byName = new Map(products.map((p) => [nameKey(p.name), p]));
    const index = new NameIndex(products, (p) => p.name);
    const used = new Set<string>();
    return items.map((item) => {
      const tryUse = (p: SupplierProductSnapshot | undefined | null, how: Match["how"]): Match | null =>
        p && !used.has(p.id) ? (used.add(p.id), { item, product: p, how }) : null;
      return (
        (item.code ? tryUse(bySku.get(item.code.toLowerCase()), "code") : null) ??
        tryUse(byName.get(nameKey(item.name)), "name") ??
        tryUse(index.best(item.name, 0.86)?.item, "fuzzy") ?? { item, product: null, how: null }
      );
    });
  }, [items, ctx]);

  const annotations = useMemo(() => {
    const a: Record<string, RowAnnotation> = {};
    for (const m of matches) {
      if (!m.product) {
        a[m.item.id] = { kind: "new" };
        continue;
      }
      if (m.item.price === null) continue;
      const mapped = toProductUnit(m.item.priceUnit, m.item.price);
      if (mapped.unit !== m.product.unit) {
        a[m.item.id] = { kind: "match", existingName: `${m.product.name} (${m.product.unit})` };
        continue;
      }
      const delta = Math.round((mapped.price - m.product.price) * 100) / 100;
      a[m.item.id] = {
        kind: Math.abs(delta) < 0.005 ? "unchanged" : delta > 0 ? "increased" : "decreased",
        delta,
        pct: m.product.price > 0 ? delta / m.product.price : null,
        existingName: m.product.name,
        existingPrice: m.product.price,
      };
    }
    return a;
  }, [matches]);

  const included = matches.filter((m) => m.item.included && m.item.price !== null && m.item.price > 0);
  const updates = included.filter((m) => m.product && ["increased", "decreased"].includes(annotations[m.item.id]?.kind ?? ""));
  const reactivate = included.filter((m) => m.product && !m.product.is_available && m.item.available);
  const creates = included.filter((m) => !m.product);
  const unchanged = included.filter((m) => m.product && annotations[m.item.id]?.kind === "unchanged").length;
  const matchedIds = new Set(matches.filter((m) => m.product && m.item.included).map((m) => m.product!.id));
  const missing = (ctx?.products ?? []).filter((p) => p.is_available && !matchedIds.has(p.id));
  const reviewLeft = items.filter((i) => i.included && needsReview(i)).length;
  const busy = state.phase === "reading" || state.phase === "analyzing";

  const save = () => {
    if (!ctx || !result) return;
    const catBySlug = new Map(ctx.categories.map((c) => [c.slug, c.id]));
    const updateRows = new Map<string, { productId: string; price?: number | null; is_available?: boolean | null }>();
    for (const m of updates) {
      const mapped = toProductUnit(m.item.priceUnit, m.item.price!);
      updateRows.set(m.product!.id, { productId: m.product!.id, price: mapped.price, is_available: m.item.available ? null : false });
    }
    for (const m of reactivate) {
      const prev = updateRows.get(m.product!.id);
      updateRows.set(m.product!.id, { productId: m.product!.id, price: prev?.price ?? null, is_available: true });
    }
    for (const m of included) {
      if (m.product && !m.item.available && m.product.is_available && !updateRows.has(m.product.id)) {
        updateRows.set(m.product.id, { productId: m.product.id, price: null, is_available: false });
      }
    }
    const createRows = creates.map((m) => {
      const i = m.item;
      const mapped = toProductUnit(i.priceUnit, i.price!);
      return {
        name: i.name.trim().slice(0, 200),
        unit: mapped.unit,
        price: mapped.price,
        category_id: catBySlug.get(platformCategorySlug(i.category)) ?? fallbackCategory,
        macro_category: toMacro(i.category),
        brand: i.brand?.slice(0, 120) ?? null,
        sku: i.code?.slice(0, 80) ?? null,
        tax_rate: i.vatRate ?? null,
        min_quantity: i.minQty?.value ?? null,
        packaging_size: i.pack.total?.value ?? null,
        packaging_unit: i.format?.slice(0, 60) ?? null,
        origin: i.origin?.slice(0, 200) ?? null,
        is_available: i.available,
        sales_unit: {
          label: `${saleUnitLabel(i.priceUnit)}${i.format && !i.format.startsWith(i.priceUnit) ? ` ${i.format}` : ""}`.slice(0, 60),
          unit_type: toSalesUnitType(i.priceUnit),
        },
      };
    });
    if (createRows.some((c) => !c.category_id)) {
      toast.error("Scegli una categoria per i nuovi prodotti");
      return;
    }
    const priceList =
      !saveList || !ctx.canEditPricing
        ? ({ kind: "none" } as const)
        : listChoice === "new"
          ? ({ kind: "new", name: listName.trim() || `Listino ${monthLabel()}` } as const)
          : ({ kind: "existing", id: listChoice } as const);

    startSaving(async () => {
      const res = await commitSupplierImport({
        creates: createRows,
        updates: [...updateRows.values()],
        deactivateIds: deactivateMissing ? missing.map((p) => p.id) : [],
        priceList,
        learning: {
          corrections: toCorrections(items),
          layouts: usedOverrides ? result.layouts.map((l) => ({ signature: l.signature, roles: Object.fromEntries(Object.entries(l.roles)) })) : [],
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDone(res.data);
      toast.success("Catalogo aggiornato");
      router.refresh();
    });
  };

  if (done) {
    return (
      <div className="f-card f-rise mx-auto flex max-w-xl flex-col items-center gap-3 px-6 py-12 text-center">
        <CheckCircle2 className="h-12 w-12 text-[var(--f-success)]" />
        <h2 className="text-[20px] font-semibold text-[var(--f-ink)]">Catalogo aggiornato</h2>
        <p className="text-[14px] text-[var(--f-muted)]">
          {done.updated} prodotti aggiornati · {done.created} nuovi
          {done.deactivated ? ` · ${done.deactivated} non disponibili` : ""}
          {done.priceListItems ? ` · ${done.priceListItems} prezzi a listino` : ""}
        </p>
        {done.learned > 0 ? (
          <p className="flex items-center gap-1.5 text-[13px] text-[var(--acc-700)]">
            <Brain className="h-4 w-4" /> {done.learned} correzioni ricordate per il prossimo import.
          </p>
        ) : null}
        <WarningsList warnings={done.warnings} />
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Link href="/supplier/catalogo" className="f-btn f-btn-primary">Vai al catalogo</Link>
          <button type="button" className="f-btn f-btn-outline" onClick={() => { setDone(null); reset(); }}>Importa un altro file</button>
        </div>
      </div>
    );
  }

  if (state.phase === "idle" || state.phase === "error") {
    return (
      <div className="flex flex-col gap-4">
        {state.phase === "error" && state.error ? <WarningsList warnings={[state.error]} /> : null}
        <SmartDropzone
          title="Trascina il tuo listino: PDF, Excel, una foto o il testo"
          hint="Riconosciamo prodotti, prezzi, unità e confezioni; aggiorniamo i prodotti che hai già e ti proponiamo quelli nuovi."
          placeholder={"Es. «Mozzarella fior di latte 125g x 8 – 6,90 €\nRicotta vaccina kg 6,50\nBurrata 200 g 3,40 €»"}
          onFile={analyzeFile}
          onText={analyzeText}
        />
        {advanced}
      </div>
    );
  }

  if (busy || !result) {
    return <ImportProgress progress={state.progress} message={state.message} label={state.sourceLabel} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={reset} className="f-btn f-btn-ghost f-btn-sm">
          <ArrowLeft className="h-4 w-4" /> Ricomincia
        </button>
        <p className="text-[13px] text-[var(--f-muted)]">
          {state.sourceLabel ? <>Da «{state.sourceLabel}» · </> : null}
          {result.products.length} prodotti riconosciuti
          {state.memoryUsed ? <span className="ml-2 inline-flex items-center gap-1 text-[var(--acc-700)]"><Brain className="h-3.5 w-3.5" /> con le tue correzioni precedenti</span> : null}
        </p>
      </div>

      <WarningsList warnings={result.warnings} />

      <section className="f-card grid gap-4 p-5 sm:px-[22px] lg:grid-cols-2" aria-label="Riepilogo">
        <div>
          <h2 className="f-card-title mb-3 flex items-center gap-2"><ListChecks className="h-4 w-4 text-[var(--acc-700)]" /> Cosa cambia nel catalogo</h2>
          <div className="flex flex-wrap gap-1.5 text-[12.5px]">
            <span className="f-tag bg-[var(--f-danger-bg)] text-[var(--f-danger)]">{updates.filter((m) => annotations[m.item.id]?.kind === "increased").length} aumenti</span>
            <span className="f-tag bg-[var(--f-success-bg)] text-[var(--f-success)]">{updates.filter((m) => annotations[m.item.id]?.kind === "decreased").length} ribassi</span>
            <span className="f-tag bg-[var(--f-info-bg)] text-[var(--f-info)]">{creates.length} nuovi prodotti</span>
            <span className="f-tag bg-[var(--f-fill)] text-[var(--f-muted)]">{unchanged} invariati</span>
            {reactivate.length ? <span className="f-tag bg-[var(--f-fill)] text-[var(--f-ink-2)]">{reactivate.length} di nuovo disponibili</span> : null}
          </div>
          {missing.length > 0 ? (
            <label className="mt-3 flex items-start gap-2 text-[13px] text-[var(--f-ink-2)]">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--acc-700)]" checked={deactivateMissing} onChange={(e) => setDeactivateMissing(e.target.checked)} />
              <span>
                Segna come <strong>non disponibili</strong> i {missing.length} prodotti del catalogo che non sono nel file
                <span className="block text-[12px] text-[var(--f-muted)]">{missing.slice(0, 4).map((p) => p.name).join(", ")}{missing.length > 4 ? "…" : ""}</span>
              </span>
            </label>
          ) : null}
          {creates.length > 0 && ctx ? (
            <label className="mt-3 block">
              <span className="f-label">Categoria per i nuovi prodotti non riconosciuti</span>
              <select className="f-input mt-1 h-10" value={fallbackCategory} onChange={(e) => setFallbackCategory(e.target.value)}>
                {ctx.categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <div>
          <h2 className="f-card-title mb-3">Listino</h2>
          <p className="text-[13px] text-[var(--f-muted)]">I prezzi del catalogo vengono sempre aggiornati.</p>
          {ctx?.canEditPricing ? (
            <>
              <label className="mt-3 flex items-center gap-2 text-[13.5px] text-[var(--f-ink)]">
                <input type="checkbox" className="h-4 w-4 accent-[var(--acc-700)]" checked={saveList} onChange={(e) => setSaveList(e.target.checked)} />
                Salva questi prezzi anche in un listino
              </label>
              {saveList ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <select className="f-input h-10" value={listChoice} onChange={(e) => setListChoice(e.target.value)} aria-label="Listino">
                    <option value="new">Nuovo listino…</option>
                    {ctx.priceLists.filter((l) => !l.is_default).map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                  {listChoice === "new" ? (
                    <input className="f-input h-10" value={listName} maxLength={120} onChange={(e) => setListName(e.target.value)} aria-label="Nome del nuovo listino" />
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-[12.5px] text-[var(--f-muted)]">Il tuo ruolo non gestisce i listini.</p>
          )}
        </div>
      </section>

      <ColumnsPanel result={result} busy={busy} onApply={(o) => { setUsedOverrides(true); void reanalyze(o); }} />

      <ProductReview items={items} onChange={setItems} annotations={annotations} />

      <div className="f-card sticky bottom-3 z-20 px-4 py-3 shadow-[0_12px_32px_rgba(16,24,20,0.12)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-[var(--f-muted)]">
            <strong className="text-[var(--f-ink)]">{updates.length + reactivate.length}</strong> aggiornamenti · <strong className="text-[var(--f-ink)]">{creates.length}</strong> nuovi
            {reviewLeft > 0 ? <span className="ml-2 text-[var(--f-warning)]">· {reviewLeft} da controllare</span> : null}
          </p>
          <button
            type="button"
            className="f-btn f-btn-primary"
            disabled={saving || !ctx || updates.length + reactivate.length + creates.length + (deactivateMissing ? missing.length : 0) === 0}
            onClick={save}
          >
            {saving ? "Salvataggio…" : "Applica al catalogo"}
          </button>
        </div>
        {!ctx ? <p className="mt-1 text-[12px] text-[var(--f-warning)]">Analisi fatta offline: ricarica la pagina per confrontare con il catalogo e salvare.</p> : null}
      </div>
    </div>
  );
}
