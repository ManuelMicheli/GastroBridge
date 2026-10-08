"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronUp, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { FCard, StatusPill } from "@/components/fernly/primitives";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { deleteRecipe, saveRecipe, searchIngredients, type IngredientHit } from "@/lib/food-cost/actions";
import { costRecipes, type PriceBook, type PricePoint, type RecipeInput } from "@/lib/food-cost/cost";
import type { RecipeEditorData } from "@/lib/food-cost/server/queries";
import { cn } from "@/lib/utils/formatters";

const eur = new Intl.NumberFormat("it-IT", { useGrouping: "always", style: "currency", currency: "EUR" });
const eur4 = new Intl.NumberFormat("it-IT", { useGrouping: "always", style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const dateFmt = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Rome" });
const UNITS = ["g", "kg", "ml", "cl", "l", "pz"];
const SOURCE_LABEL: Record<string, string> = {
  invoice: "fattura",
  catalog: "catalogo",
  listino: "listino",
  manual: "a mano",
  sub_recipe: "semilavorato",
};
const HIT_TONE: Record<IngredientHit["source"], "success" | "info" | "accent" | "neutral"> = {
  fattura: "success",
  catalogo: "info",
  listino: "accent",
  semilavorato: "neutral",
};

type Line = {
  key: string;
  kind: "product" | "sub_recipe" | "manual";
  priceKey: string | null;
  productId: string | null;
  catalogId: string | null;
  subRecipeId: string | null;
  name: string;
  quantity: string;
  unit: string;
  wastePct: string;
  manualPrice: string;
  manualPriceUnit: string;
};

/** "1,5" / "1.5" / "1.250,50" → number (NaN when empty or invalid). */
function num(s: string): number {
  const t = s.replace(/\s/g, "");
  if (!t) return NaN;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : NaN;
}

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return String(Math.round(n * 10000) / 10000).replace(".", ",");
}

let seq = 0;
const newKey = () => `l${Date.now().toString(36)}${(seq++).toString(36)}`;

export function RecipeEditor({ data, canWrite, initialKind }: { data: RecipeEditorData; canWrite: boolean; initialKind: "dish" | "base" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { confirm, dialog } = useConfirm();
  const r = data.recipe;
  const [name, setName] = useState(r?.name ?? "");
  const [kind, setKind] = useState<"dish" | "base">(r?.kind ?? initialKind);
  const [category, setCategory] = useState(r?.category ?? "");
  const [portions, setPortions] = useState(fmtNum(r ? Number(r.portions) : 1));
  const [yieldQty, setYieldQty] = useState(fmtNum(r?.yield_qty !== null && r?.yield_qty !== undefined ? Number(r.yield_qty) : null));
  const [yieldUnit, setYieldUnit] = useState(r?.yield_unit ?? "kg");
  const [salePrice, setSalePrice] = useState(fmtNum(r?.sale_price !== null && r?.sale_price !== undefined ? Number(r.sale_price) : null));
  const [vatRate, setVatRate] = useState(fmtNum(r ? Number(r.vat_rate) : 10));
  const [target, setTarget] = useState(fmtNum(r ? Number(r.target_food_cost_pct) : 30));
  const [notes, setNotes] = useState(r?.notes ?? "");
  const [lines, setLines] = useState<Line[]>(() =>
    data.ingredients.map((i) => ({
      key: i.id,
      kind: i.kind,
      priceKey: i.price_key,
      productId: i.product_id,
      catalogId: i.catalog_id,
      subRecipeId: i.sub_recipe_id,
      name: i.name,
      quantity: fmtNum(Number(i.quantity)),
      unit: i.unit,
      wastePct: fmtNum(Number(i.waste_pct)),
      manualPrice: fmtNum(i.manual_price !== null ? Number(i.manual_price) : null),
      manualPriceUnit: i.manual_price_unit ?? "kg",
    })),
  );
  const [extraBook, setExtraBook] = useState<Record<string, PricePoint[]>>({});
  const [dirty, setDirty] = useState(false);
  const touch = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setDirty(true);
  };

  // Live costing with the same pure engine as the server.
  const preview = useMemo(() => {
    const book: PriceBook = new Map(Object.entries({ ...data.book, ...extraBook }));
    const stubs: RecipeInput[] = data.subRecipes
      .filter((s) => s.costPerYieldBase)
      .map((s) => ({
        id: s.id,
        name: s.name,
        kind: "base",
        portions: 1,
        yieldQty: 1,
        yieldUnit: s.costPerYieldBase!.base,
        salePrice: null,
        vatRate: 0,
        targetFoodCostPct: 30,
        ingredients: [
          {
            id: `${s.id}-stub`,
            kind: "manual",
            priceKey: null,
            subRecipeId: null,
            name: s.name,
            quantity: 1,
            unit: s.costPerYieldBase!.base,
            wastePct: 0,
            manualPrice: s.costPerYieldBase!.price,
            manualPriceUnit: s.costPerYieldBase!.base,
          },
        ],
      }));
    const self: RecipeInput = {
      id: "self",
      name: name || "Ricetta",
      kind,
      portions: num(portions) > 0 ? num(portions) : 1,
      yieldQty: kind === "base" && num(yieldQty) > 0 ? num(yieldQty) : null,
      yieldUnit: kind === "base" ? yieldUnit : null,
      salePrice: kind === "dish" && num(salePrice) > 0 ? num(salePrice) : null,
      vatRate: Number.isFinite(num(vatRate)) ? num(vatRate) : 10,
      targetFoodCostPct: num(target) > 0 ? num(target) : 30,
      ingredients: lines
        .filter((l) => num(l.quantity) > 0)
        .map((l) => ({
          id: l.key,
          kind: l.kind,
          priceKey: l.priceKey,
          subRecipeId: l.subRecipeId,
          name: l.name,
          quantity: num(l.quantity),
          unit: l.unit,
          wastePct: Number.isFinite(num(l.wastePct)) ? num(l.wastePct) : 0,
          manualPrice: l.manualPrice.trim() && Number.isFinite(num(l.manualPrice)) ? num(l.manualPrice) : null,
          manualPriceUnit: l.manualPriceUnit,
        })),
    };
    return costRecipes([self, ...stubs], book).get("self") ?? null;
  }, [data.book, data.subRecipes, extraBook, name, kind, portions, yieldQty, yieldUnit, salePrice, vatRate, target, lines]);

  const lineCost = new Map((preview?.lines ?? []).map((l) => [l.ingredientId, l]));
  const targetN = num(target) > 0 ? num(target) : 30;
  const vatN = Number.isFinite(num(vatRate)) ? num(vatRate) : 10;
  const suggested = preview && preview.costPerPortion > 0 ? (preview.costPerPortion / (targetN / 100)) * (1 + vatN / 100) : null;
  const over = preview?.foodCostPct !== null && preview?.foodCostPct !== undefined && preview.foodCostPct > targetN;

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    setDirty(true);
  }

  function addHit(h: IngredientHit) {
    if (h.priceKey && h.points.length > 0) setExtraBook((b) => ({ ...b, [h.priceKey!]: h.points }));
    setLines((ls) => [
      ...ls,
      {
        key: newKey(),
        kind: h.kind,
        priceKey: h.priceKey,
        productId: h.productId,
        catalogId: h.catalogId,
        subRecipeId: h.subRecipeId,
        name: h.name,
        quantity: "",
        unit: h.unit,
        wastePct: "0",
        manualPrice: "",
        manualPriceUnit: h.unit === "g" ? "kg" : h.unit === "ml" ? "l" : "pz",
      },
    ]);
    setDirty(true);
  }

  function addManual(label: string) {
    setLines((ls) => [
      ...ls,
      {
        key: newKey(),
        kind: "manual",
        priceKey: null,
        productId: null,
        catalogId: null,
        subRecipeId: null,
        name: label,
        quantity: "",
        unit: "g",
        wastePct: "0",
        manualPrice: "",
        manualPriceUnit: "kg",
      },
    ]);
    setDirty(true);
  }

  function move(key: string, dir: -1 | 1) {
    setLines((ls) => {
      const i = ls.findIndex((l) => l.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ls.length) return ls;
      const next = [...ls];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
    setDirty(true);
  }

  function save() {
    if (!name.trim()) {
      toast.error("Dai un nome alla ricetta");
      return;
    }
    const bad = lines.find((l) => !(num(l.quantity) > 0));
    if (bad) {
      toast.error(`Inserisci la quantità di «${bad.name}»`);
      return;
    }
    const payload = {
      id: r?.id ?? null,
      name: name.trim(),
      kind,
      category: category.trim() || null,
      portions: num(portions) > 0 ? num(portions) : 1,
      yieldQty: kind === "base" && num(yieldQty) > 0 ? num(yieldQty) : null,
      yieldUnit: kind === "base" ? yieldUnit : null,
      salePrice: kind === "dish" && num(salePrice) > 0 ? num(salePrice) : null,
      vatRate: Number.isFinite(num(vatRate)) ? num(vatRate) : 10,
      targetPct: targetN,
      notes: notes.trim() || null,
      ingredients: lines.map((l) => ({
        kind: l.kind,
        priceKey: l.priceKey,
        productId: l.productId,
        catalogId: l.catalogId,
        subRecipeId: l.subRecipeId,
        name: l.name.trim().slice(0, 200) || "Ingrediente",
        quantity: num(l.quantity),
        unit: l.unit,
        wastePct: Math.min(94, Math.max(0, Number.isFinite(num(l.wastePct)) ? num(l.wastePct) : 0)),
        manualPrice: l.manualPrice.trim() && Number.isFinite(num(l.manualPrice)) ? num(l.manualPrice) : null,
        manualPriceUnit: l.manualPrice.trim() ? l.manualPriceUnit : null,
      })),
    };
    start(async () => {
      const res = await saveRecipe(payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDirty(false);
      toast.success("Ricetta salvata");
      if (!r) router.replace(`/finanze/ricette/${res.data.id}`);
      else router.refresh();
    });
  }

  async function remove() {
    if (!r) return;
    const ok = await confirm({
      title: `Eliminare «${r.name}»?`,
      description: data.usedIn.length > 0 ? `È usata in: ${data.usedIn.map((u) => u.name).join(", ")}.` : "L'operazione non si può annullare.",
      confirmLabel: "Elimina",
      tone: "danger",
    });
    if (!ok) return;
    start(async () => {
      const res = await deleteRecipe(r.id);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Ricetta eliminata");
        router.push("/finanze/ricette");
      }
    });
  }

  return (
    <div className="px-1 lg:px-0">
      {dialog}
      <div className="mb-3 flex items-center gap-2">
        <Link href="/finanze/ricette" className="f-icon-btn !h-9 !w-9" aria-label="Torna alle ricette">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-[13px] text-[var(--f-muted)]">Food cost</span>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-3 lg:gap-4">
          <FCard index={0}>
            <fieldset disabled={!canWrite} className="space-y-3">
              <input
                className="w-full bg-transparent text-[24px] font-semibold tracking-[-0.02em] text-[var(--f-ink)] outline-none placeholder:text-[var(--f-faint)]"
                placeholder={kind === "dish" ? "Nome del piatto (es. Carbonara)" : "Nome del semilavorato (es. Ragù)"}
                value={name}
                onChange={(e) => touch(setName)(e.target.value)}
                aria-label="Nome"
              />
              <div className="flex flex-wrap items-center gap-2">
                {(["dish", "base"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => touch(setKind)(k)}
                    className={cn("f-btn f-btn-xs", kind === k ? "f-btn-primary" : "f-btn-soft")}
                    aria-pressed={kind === k}
                  >
                    {k === "dish" ? "Piatto in carta" : "Semilavorato"}
                  </button>
                ))}
                <input
                  className="f-input !h-8 !w-44 !text-[13px]"
                  list="recipe-categories"
                  placeholder="Categoria (es. Primi)"
                  value={category}
                  onChange={(e) => touch(setCategory)(e.target.value)}
                  aria-label="Categoria"
                />
                <datalist id="recipe-categories">
                  {data.categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {kind === "dish" ? (
                  <>
                    <Field label="Porzioni prodotte">
                      <input className="f-input" inputMode="decimal" value={portions} onChange={(e) => touch(setPortions)(e.target.value)} />
                    </Field>
                    <Field label="Prezzo in carta (IVA incl.)">
                      <input className="f-input" inputMode="decimal" placeholder="€" value={salePrice} onChange={(e) => touch(setSalePrice)(e.target.value)} />
                    </Field>
                    <Field label="IVA %">
                      <input className="f-input" inputMode="decimal" value={vatRate} onChange={(e) => touch(setVatRate)(e.target.value)} />
                    </Field>
                    <Field label="Obiettivo food cost %">
                      <input className="f-input" inputMode="decimal" value={target} onChange={(e) => touch(setTarget)(e.target.value)} />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label="Resa (quanto ne ottieni)">
                      <input className="f-input" inputMode="decimal" placeholder="es. 2" value={yieldQty} onChange={(e) => touch(setYieldQty)(e.target.value)} />
                    </Field>
                    <Field label="Unità della resa">
                      <select className="f-input" value={yieldUnit} onChange={(e) => touch(setYieldUnit)(e.target.value)}>
                        {["kg", "g", "l", "ml", "pz"].map((u) => (
                          <option key={u}>{u}</option>
                        ))}
                      </select>
                    </Field>
                  </>
                )}
              </div>
            </fieldset>
          </FCard>

          <FCard index={1} title="Ingredienti" action={<span className="text-[12.5px] text-[var(--f-muted)]">{lines.length}</span>}>
            {lines.length > 0 && (
              <ul className="mb-3 divide-y divide-[var(--f-line)]">
                {lines.map((l, idx) => {
                  const c = lineCost.get(l.key);
                  const isManual = l.kind === "manual" || (c?.missing && l.kind === "product");
                  return (
                    <li key={l.key} className="py-3">
                      <div className="flex items-start gap-2">
                        {canWrite && (
                          <div className="flex shrink-0 flex-col pt-1 text-[var(--f-faint)]">
                            <button type="button" aria-label="Sposta su" disabled={idx === 0} onClick={() => move(l.key, -1)} className="disabled:opacity-30">
                              <ChevronUp className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <input
                              className="min-w-0 flex-1 bg-transparent text-[14px] font-medium text-[var(--f-ink)] outline-none"
                              value={l.name}
                              disabled={!canWrite}
                              onChange={(e) => updateLine(l.key, { name: e.target.value })}
                              aria-label="Ingrediente"
                            />
                            <span className="shrink-0 text-[14px] font-semibold tabular-nums text-[var(--f-ink)]">
                              {c?.cost !== null && c?.cost !== undefined ? eur.format(c.cost) : "—"}
                            </span>
                          </div>
                          <p className="text-[12px] text-[var(--f-muted)]">
                            {c?.source ? (
                              <>
                                {c.unitCost !== null ? `${eur4.format(c.unitCost)}/${c.base}` : ""} · da {SOURCE_LABEL[c.source] ?? c.source}
                                {c.priceDate ? ` del ${dateFmt.format(new Date(`${c.priceDate}T12:00:00Z`))}` : ""}
                              </>
                            ) : c?.missing ? (
                              <span className="text-[var(--f-warning)]">{c.missing}</span>
                            ) : (
                              "Inserisci la quantità"
                            )}
                          </p>
                          <fieldset disabled={!canWrite} className="mt-2 flex flex-wrap items-end gap-2">
                            <Field label="Quantità" small>
                              <input
                                className="f-input !h-9 !w-24"
                                inputMode="decimal"
                                value={l.quantity}
                                onChange={(e) => updateLine(l.key, { quantity: e.target.value })}
                              />
                            </Field>
                            <Field label="Unità" small>
                              <select className="f-input !h-9 !w-20" value={l.unit} onChange={(e) => updateLine(l.key, { unit: e.target.value })}>
                                {[...new Set([...UNITS, l.unit])].map((u) => (
                                  <option key={u}>{u}</option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Scarto %" small>
                              <input
                                className="f-input !h-9 !w-20"
                                inputMode="decimal"
                                value={l.wastePct}
                                onChange={(e) => updateLine(l.key, { wastePct: e.target.value })}
                              />
                            </Field>
                            {isManual && (
                              <>
                                <Field label="Prezzo a mano €" small>
                                  <input
                                    className="f-input !h-9 !w-24"
                                    inputMode="decimal"
                                    value={l.manualPrice}
                                    onChange={(e) => updateLine(l.key, { manualPrice: e.target.value })}
                                  />
                                </Field>
                                <Field label="per" small>
                                  <select
                                    className="f-input !h-9 !w-20"
                                    value={l.manualPriceUnit}
                                    onChange={(e) => updateLine(l.key, { manualPriceUnit: e.target.value })}
                                  >
                                    {["kg", "l", "pz"].map((u) => (
                                      <option key={u}>{u}</option>
                                    ))}
                                  </select>
                                </Field>
                              </>
                            )}
                            {canWrite && (
                              <button
                                type="button"
                                className="f-icon-btn !h-9 !w-9 ml-auto"
                                aria-label={`Rimuovi ${l.name}`}
                                onClick={() => {
                                  setLines((ls) => ls.filter((x) => x.key !== l.key));
                                  setDirty(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </fieldset>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {canWrite && <IngredientSearch onPick={addHit} onManual={addManual} excludeSub={r?.id ?? null} />}
          </FCard>

          <FCard index={2} title="Note e procedimento">
            <textarea
              className="f-input !h-28 resize-y !py-3"
              value={notes}
              disabled={!canWrite}
              maxLength={2000}
              onChange={(e) => touch(setNotes)(e.target.value)}
              placeholder="Grammature, cottura, impiattamento…"
            />
          </FCard>
        </div>

        <aside className="flex min-w-0 flex-col gap-3 lg:gap-4 xl:sticky xl:top-4 xl:self-start">
          <FCard index={3} title="Costo">
            {kind === "dish" ? (
              <div>
                <p className="text-[13px] text-[var(--f-muted)]">Food cost</p>
                <p className={cn("text-[40px] font-semibold leading-none tabular-nums", over ? "text-[var(--f-danger)]" : "text-[var(--f-ink)]")}>
                  {preview?.foodCostPct !== null && preview?.foodCostPct !== undefined ? `${preview.foodCostPct.toFixed(1).replace(".", ",")}%` : "—"}
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--f-fill-2)]" aria-hidden>
                  <div
                    className={cn("h-full rounded-full", over ? "bg-[var(--f-danger)]" : "bg-[var(--f-success)]")}
                    style={{ width: `${Math.min(100, ((preview?.foodCostPct ?? 0) / Math.max(targetN * 1.6, 1)) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-[12px] text-[var(--f-muted)]">Obiettivo {targetN.toString().replace(".", ",")}%</p>
                <dl className="mt-4 space-y-1.5 text-[13.5px]">
                  <Row label="Costo per porzione" value={eur.format(preview?.costPerPortion ?? 0)} strong />
                  <Row label="Prezzo netto (senza IVA)" value={preview?.netPrice !== null && preview?.netPrice !== undefined ? eur.format(preview.netPrice) : "—"} />
                  <Row label="Margine per porzione" value={preview?.margin !== null && preview?.margin !== undefined ? eur.format(preview.margin) : "—"} strong />
                  <Row label="Costo totale ricetta" value={eur.format(preview?.totalCost ?? 0)} />
                </dl>
                {suggested !== null && (
                  <p className="mt-3 rounded-[12px] bg-[var(--f-fill)] px-3 py-2 text-[12.5px] text-[var(--f-ink-2)]">
                    Per stare al {targetN.toString().replace(".", ",")}% il prezzo in carta dovrebbe essere almeno{" "}
                    <strong className="tabular-nums">{eur.format(Math.ceil(suggested * 2) / 2)}</strong>.
                  </p>
                )}
              </div>
            ) : (
              <dl className="space-y-1.5 text-[13.5px]">
                <Row label="Costo totale" value={eur.format(preview?.totalCost ?? 0)} strong />
                <Row
                  label="Costo per unità di resa"
                  value={preview?.costPerYieldBase ? `${eur4.format(preview.costPerYieldBase.price)}/${preview.costPerYieldBase.base}` : "—"}
                  strong
                />
              </dl>
            )}
            {(preview?.missingCount ?? 0) > 0 && (
              <p className="mt-3 text-[12.5px] text-[var(--f-warning)]">
                {preview!.missingCount === 1 ? "1 ingrediente senza prezzo" : `${preview!.missingCount} ingredienti senza prezzo`}: il costo è
                sottostimato.
              </p>
            )}
            {canWrite && (
              <div className="mt-4 flex flex-col gap-2">
                <button type="button" className="f-btn f-btn-primary f-btn-block" onClick={save} disabled={pending || (!dirty && !!r)}>
                  {pending ? "Salvo…" : r ? (dirty ? "Salva modifiche" : "Salvata") : "Salva ricetta"}
                </button>
                {r && (
                  <button type="button" className="f-btn f-btn-ghost f-btn-block text-[var(--f-danger)]" onClick={remove} disabled={pending}>
                    <Trash2 className="h-4 w-4" aria-hidden /> Elimina
                  </button>
                )}
              </div>
            )}
          </FCard>
          {data.usedIn.length > 0 && (
            <FCard index={4} title="Usato in">
              <ul className="space-y-1 text-[13.5px]">
                {data.usedIn.map((u) => (
                  <li key={u.id}>
                    <Link href={`/finanze/ricette/${u.id}`} className="text-[var(--acc-ink)] hover:underline">
                      {u.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </FCard>
          )}
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children, small = false }: { label: string; children: React.ReactNode; small?: boolean }) {
  return (
    <label className="block min-w-0">
      <span className={cn("f-label mb-1 block", small && "!text-[11.5px]")}>{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[var(--f-muted)]">{label}</dt>
      <dd className={cn("tabular-nums", strong ? "font-semibold text-[var(--f-ink)]" : "text-[var(--f-ink-2)]")}>{value}</dd>
    </div>
  );
}

function IngredientSearch({
  onPick,
  onManual,
  excludeSub,
}: {
  onPick: (h: IngredientHit) => void;
  onManual: (name: string) => void;
  excludeSub: string | null;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<IngredientHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    const t = window.setTimeout(async () => {
      const res = await searchIngredients(term);
      if (id !== reqId.current) return;
      setLoading(false);
      if (res.ok) setHits(res.data.filter((h) => h.subRecipeId !== excludeSub));
    }, 250);
    return () => window.clearTimeout(t);
  }, [q, excludeSub]);

  function pick(h: IngredientHit) {
    onPick(h);
    setQ("");
    setHits([]);
    setOpen(false);
  }

  return (
    <div className="relative">
      <label className="relative block">
        <span className="sr-only">Aggiungi ingrediente</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--f-faint)]" aria-hidden />
        <input
          className="f-input !pl-9"
          placeholder="Aggiungi ingrediente: cerca tra fatture, cataloghi e semilavorati"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && hits[0]) {
              e.preventDefault();
              pick(hits[0]);
            }
            if (e.key === "Escape") setOpen(false);
          }}
          role="combobox"
          aria-expanded={open && q.trim().length >= 2}
          aria-controls="ingredient-hits"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--f-faint)]" aria-hidden />}
      </label>
      {open && q.trim().length >= 2 && (
        <ul
          id="ingredient-hits"
          role="listbox"
          className="absolute z-20 mt-1.5 max-h-80 w-full overflow-y-auto rounded-[14px] border border-[var(--f-line)] bg-[var(--f-card)] p-1.5 shadow-[var(--f-shadow-pop)]"
        >
          {hits.map((h) => (
            <li key={`${h.priceKey ?? h.subRecipeId}`} role="option" aria-selected={false}>
              <button type="button" onClick={() => pick(h)} className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left hover:bg-[var(--f-fill)]">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-[var(--f-ink)]">{h.name}</p>
                  <p className="truncate text-[11.5px] text-[var(--f-muted)]">{h.detail ?? ""}</p>
                </div>
                {h.priceLabel && <span className="shrink-0 text-[12px] tabular-nums text-[var(--f-ink-2)]">{h.priceLabel}</span>}
                <StatusPill tone={HIT_TONE[h.source]}>{h.source}</StatusPill>
              </button>
            </li>
          ))}
          {!loading && hits.length === 0 && <li className="px-2.5 py-2 text-[12.5px] text-[var(--f-muted)]">Nessun prodotto trovato.</li>}
          <li>
            <button
              type="button"
              onClick={() => {
                onManual(q.trim());
                setQ("");
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[13px] text-[var(--acc-ink)] hover:bg-[var(--f-fill)]"
            >
              <Plus className="h-4 w-4" aria-hidden /> Aggiungi «{q.trim()}» con prezzo a mano
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
