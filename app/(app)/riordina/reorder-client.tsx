"use client";

// Riordino rapido — one card per supplier with the items the restaurant buys,
// explainable suggestions, cut-off countdown and a keypad-friendly stepper.

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes,
  CalendarClock,
  History,
  ListChecks,
  Search,
  ShoppingCart,
  Sparkles,
  Store,
  Wand2,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "@/components/ui/toast";
import { Chips } from "@/components/fernly/chips";
import { CardEmpty, FCard, IconTile, StatusPill } from "@/components/fernly/primitives";
import { useCart } from "@/lib/hooks/useCart";
import { formatCurrency } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils/formatters";
import { CutoffChip } from "@/components/restaurant/ordering/cutoff-chip";
import { KeypadModal, QtyStepper } from "@/components/restaurant/ordering/qty-keypad";
import { formatQty, offerToCartItem } from "@/lib/restaurants/ordering/types";
import { suggestedQty } from "@/lib/restaurants/ordering/predict";
import { saveParLevel } from "@/lib/restaurants/ordering/actions";
import type { GuideLine, GuideSupplier } from "@/lib/restaurants/ordering/guide";

type Field = "qty" | "onHand" | "par";
type KeypadTarget = { key: string; field: Field; title: string; subtitle?: string; initial: number } | null;
type Filter = "all" | "due";

const dateFmt = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short" });

function stepFor(unit: string): number {
  const u = unit.toLowerCase();
  return u === "kg" || u === "l" || u === "lt" ? 0.5 : 1;
}

export function ReorderClient({
  suppliers,
  canOrder,
  canEditPar,
}: {
  suppliers: GuideSupplier[];
  canOrder: boolean;
  canEditPar: boolean;
}) {
  const router = useRouter();
  const { addItem } = useCart();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [onHand, setOnHand] = useState<Record<string, number>>({});
  const [parOverride, setParOverride] = useState<Record<string, number | null>>({});
  const [countMode, setCountMode] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [keypad, setKeypad] = useState<KeypadTarget>(null);
  const [, startTransition] = useTransition();

  const withHistory = suppliers.filter((s) => s.lines.length > 0);
  const withoutHistory = suppliers.filter((s) => s.lines.length === 0);

  const parOf = (l: GuideLine) => (l.key in parOverride ? parOverride[l.key]! : l.par);
  const onHandOf = (key: string) => (key in onHand ? onHand[key]! : null);
  const suggestion = (l: GuideLine) => suggestedQty(l.stats, parOf(l), onHandOf(l.key));

  const q = query.trim().toLowerCase();
  const visibleLines = (s: GuideSupplier) =>
    s.lines.filter((l) => {
      if (q && !l.name.toLowerCase().includes(q)) return false;
      if (filter === "due") {
        const par = parOf(l);
        const oh = onHandOf(l.key);
        const belowPar = par !== null && oh !== null && oh < par;
        return !!l.offer && (l.stats?.due || belowPar);
      }
      return true;
    });

  const totals = useMemo(() => {
    let lines = 0;
    let amount = 0;
    for (const s of suppliers) {
      for (const l of s.lines) {
        const v = qty[l.key] ?? 0;
        if (v > 0 && l.offer) {
          lines += 1;
          amount += v * l.offer.price;
        }
      }
    }
    return { lines, amount };
  }, [qty, suppliers]);

  const dueTotal = suppliers.reduce((n, s) => n + s.dueCount, 0);

  function setLine(key: string, v: number) {
    setQty((prev) => ({ ...prev, [key]: v }));
  }

  function fill(s: GuideSupplier, mode: "last" | "suggested") {
    setQty((prev) => {
      const next = { ...prev };
      for (const l of s.lines) {
        if (!l.offer) continue;
        if (mode === "last") next[l.key] = l.stats?.lastQty ?? 0;
        else {
          const par = parOf(l);
          const oh = onHandOf(l.key);
          const due = l.stats?.due || (par !== null && oh !== null && oh < par);
          next[l.key] = due ? suggestion(l) : 0;
        }
      }
      return next;
    });
  }

  function clear(s: GuideSupplier) {
    setQty((prev) => {
      const next = { ...prev };
      for (const l of s.lines) delete next[l.key];
      return next;
    });
  }

  function addToCart(list: GuideSupplier[]) {
    let added = 0;
    const done: string[] = [];
    for (const s of list) {
      for (const l of s.lines) {
        const v = qty[l.key] ?? 0;
        if (v > 0 && l.offer) {
          addItem(offerToCartItem(l.offer, v));
          added += 1;
          done.push(l.key);
        }
      }
    }
    if (added === 0) {
      toast.error("Imposta almeno una quantità");
      return;
    }
    setQty((prev) => {
      const next = { ...prev };
      for (const k of done) delete next[k];
      return next;
    });
    toast.success(`${added} rig${added === 1 ? "a aggiunta" : "he aggiunte"} al carrello`, {
      action: { label: "Vai al carrello", onClick: () => router.push("/carrello") },
    });
  }

  function confirmKeypad(v: number) {
    if (!keypad) return;
    const { key, field } = keypad;
    if (field === "qty") setLine(key, v);
    else if (field === "onHand") setOnHand((p) => ({ ...p, [key]: v }));
    else {
      const line = suppliers.flatMap((s) => s.lines).find((l) => l.key === key);
      const par = v > 0 ? v : null;
      setParOverride((p) => ({ ...p, [key]: par }));
      if (line) {
        startTransition(async () => {
          const res = await saveParLevel({ key, name: line.name, unit: line.unit, par });
          if (!res.ok) toast.error(res.error);
          else toast.success(par === null ? "Scorta minima rimossa" : "Scorta minima salvata");
        });
      }
    }
    setKeypad(null);
  }

  return (
    <div className="px-1 pt-3 lg:px-0 lg:pt-0">
      <PageHeader
        title="Riordino rapido"
        subtitle="I prodotti che ordini davvero, fornitore per fornitore, con le quantità di sempre e l'orario limite per ordinare."
        actions={
          <>
            <Link href="/ordine-veloce" className="f-btn f-btn-primary">
              <Wand2 className="h-4 w-4" /> Ordine veloce
            </Link>
            <Link href="/consegne" className="f-btn f-btn-outline">
              <CalendarClock className="h-4 w-4" /> Consegne
            </Link>
          </>
        }
      />

      {withHistory.length > 0 && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Chips<Filter>
              size="sm"
              ariaLabel="Filtro prodotti"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "Tutti" },
                { value: "due", label: dueTotal > 0 ? `Da riordinare · ${dueTotal}` : "Da riordinare" },
              ]}
            />
            <button
              type="button"
              onClick={() => setCountMode((v) => !v)}
              className={cn("f-btn f-btn-sm", countMode ? "f-btn-primary" : "f-btn-outline")}
              aria-pressed={countMode}
            >
              <Boxes className="h-3.5 w-3.5" /> Conta scorte
            </button>
          </div>
          <label className="f-input flex h-10 items-center gap-2 px-3 sm:w-[280px]">
            <Search className="h-4 w-4 text-[var(--f-faint)]" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtra prodotti…"
              className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
              aria-label="Filtra prodotti"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Pulisci filtro">
                <X className="h-4 w-4 text-[var(--f-muted)]" />
              </button>
            )}
          </label>
        </div>
      )}

      {countMode && (
        <p className="mb-4 rounded-[14px] bg-[var(--acc-50)] px-4 py-3 text-[13px] text-[var(--acc-ink)]">
          Conta quello che hai in magazzino: con una <b>scorta minima</b> impostata, il suggerito diventa
          scorta minima − giacenza.{" "}
          {canEditPar ? "Tocca “min” per impostarla." : "Le scorte minime le imposta chi ha il permesso dal ruolo."}
        </p>
      )}

      {withHistory.length === 0 ? (
        <FCard index={0}>
          <CardEmpty
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/cerca" className="f-btn f-btn-sm f-btn-primary">
                  <Search className="h-3.5 w-3.5" /> Cerca prodotti
                </Link>
                <Link href="/ordine-veloce" className="f-btn f-btn-sm f-btn-outline">
                  <Wand2 className="h-3.5 w-3.5" /> Ordine veloce
                </Link>
              </div>
            }
          >
            Dopo i primi ordini qui trovi, per ogni fornitore, i prodotti che compri di solito con le quantità
            pronte da confermare.
          </CardEmpty>
        </FCard>
      ) : (
        <div className="space-y-3 lg:space-y-4">
          {withHistory.map((s, i) => {
            const lines = visibleLines(s);
            if ((q || filter === "due") && lines.length === 0) return null;
            const subtotal = s.lines.reduce((sum, l) => sum + (qty[l.key] ?? 0) * (l.offer?.price ?? 0), 0);
            const min = s.minOrderAmount ?? 0;
            const selected = s.lines.filter((l) => (qty[l.key] ?? 0) > 0 && l.offer).length;
            return (
              <FCard key={s.key} index={i} bodyClassName="!flex-none">
                <header className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <IconTile seed={s.name} size={38}>
                      <Store className="h-4 w-4" />
                    </IconTile>
                    <div className="min-w-0">
                      <h2 className="truncate text-[17px] font-semibold text-[var(--f-ink)]">{s.name}</h2>
                      <p className="text-[12px] text-[var(--f-muted)]">
                        {s.lastOrderAt ? `Ultimo ordine ${dateFmt.format(new Date(s.lastOrderAt))}` : "Mai ordinato"}
                        {s.dueCount > 0 ? ` · ${s.dueCount} da riordinare` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {s.schedule ? (
                      <CutoffChip deadlineMs={s.deadlineMs} deliveryDate={s.deliveryDate} />
                    ) : (
                      <Link href="/consegne" className="f-status" data-tone="neutral">
                        <CalendarClock className="h-3 w-3" /> Imposta giorni di consegna
                      </Link>
                    )}
                  </div>
                </header>

                {canOrder && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    <button type="button" className="f-btn f-btn-xs f-btn-soft" onClick={() => fill(s, "last")}>
                      <History className="h-3.5 w-3.5" /> Come l&apos;ultima volta
                    </button>
                    <button type="button" className="f-btn f-btn-xs f-btn-soft" onClick={() => fill(s, "suggested")}>
                      <Sparkles className="h-3.5 w-3.5" /> Suggeriti
                    </button>
                    {selected > 0 && (
                      <button type="button" className="f-btn f-btn-xs f-btn-ghost" onClick={() => clear(s)}>
                        Svuota
                      </button>
                    )}
                  </div>
                )}

                <ul className="divide-y divide-[var(--f-line)]">
                  {lines.map((l) => (
                    <GuideRow
                      key={l.key}
                      line={l}
                      qty={qty[l.key] ?? 0}
                      par={parOf(l)}
                      onHand={onHandOf(l.key)}
                      suggestion={suggestion(l)}
                      countMode={countMode}
                      canOrder={canOrder}
                      canEditPar={canEditPar}
                      onQty={(v) => setLine(l.key, v)}
                      onKeypad={(field) =>
                        setKeypad({
                          key: l.key,
                          field,
                          title:
                            field === "qty" ? l.name : field === "onHand" ? `Giacenza · ${l.name}` : `Scorta minima · ${l.name}`,
                          subtitle: `Unità: ${l.unit}`,
                          initial:
                            field === "qty"
                              ? qty[l.key] ?? 0
                              : field === "onHand"
                                ? onHandOf(l.key) ?? 0
                                : parOf(l) ?? 0,
                        })
                      }
                    />
                  ))}
                </ul>

                <footer className="mt-4 flex flex-col gap-3 border-t border-[var(--f-line)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 text-[13px] text-[var(--f-muted)]">
                    <span className="font-semibold tabular-nums text-[var(--f-ink)]">{formatCurrency(subtotal)}</span>
                    {selected > 0 ? ` · ${selected} righe` : ""}
                    {min > 0 && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-[var(--f-fill-2)]">
                          <div
                            className="h-full rounded-full bg-[var(--acc-600)] transition-[width] duration-300"
                            style={{ width: `${Math.min(100, (subtotal / min) * 100)}%` }}
                          />
                        </div>
                        <span className={subtotal >= min ? "text-[var(--f-success)]" : ""}>
                          {subtotal >= min ? "Minimo raggiunto" : `Minimo ${formatCurrency(min)}`}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={s.kind === "catalog" ? `/cataloghi/${s.key}` : `/fornitori`}
                      className="f-btn f-btn-sm f-btn-outline"
                    >
                      <ListChecks className="h-3.5 w-3.5" /> Listino
                    </Link>
                    {canOrder && (
                      <button
                        type="button"
                        className="f-btn f-btn-sm f-btn-primary"
                        disabled={selected === 0}
                        onClick={() => addToCart([s])}
                      >
                        <ShoppingCart className="h-3.5 w-3.5" /> Aggiungi al carrello
                      </button>
                    )}
                  </div>
                </footer>
              </FCard>
            );
          })}
        </div>
      )}

      {withoutHistory.length > 0 && (
        <FCard className="mt-4" title="Altri fornitori" index={withHistory.length + 1}>
          <p className="mb-3 text-[13px] text-[var(--f-muted)]">
            Ancora nessun ordine da questi fornitori: cerca i prodotti o usa l&apos;ordine veloce.
          </p>
          <div className="flex flex-wrap gap-2">
            {withoutHistory.map((s) => (
              <Link
                key={s.key}
                href={s.kind === "catalog" ? `/cataloghi/${s.key}` : "/cerca"}
                className="f-btn f-btn-sm f-btn-outline"
              >
                <Store className="h-3.5 w-3.5" /> {s.name}
              </Link>
            ))}
          </div>
        </FCard>
      )}

      {canOrder && totals.lines > 0 && (
        <div className="sticky bottom-[96px] z-30 mt-4 lg:bottom-4">
          <div className="f-card flex items-center justify-between gap-3 px-4 py-3 shadow-[var(--f-shadow-pop)]">
            <div className="min-w-0 text-[13px] text-[var(--f-muted)]">
              <span className="block text-[17px] font-semibold tabular-nums text-[var(--f-ink)]">
                {formatCurrency(totals.amount)}
              </span>
              {totals.lines} righe pronte · IVA esclusa
            </div>
            <button type="button" className="f-btn f-btn-primary" onClick={() => addToCart(suppliers)}>
              <ShoppingCart className="h-4 w-4" /> Aggiungi tutto
            </button>
          </div>
        </div>
      )}

      <KeypadModal
        open={keypad !== null}
        title={keypad?.title ?? ""}
        subtitle={keypad?.subtitle}
        initial={keypad?.initial ?? 0}
        onClose={() => setKeypad(null)}
        onConfirm={confirmKeypad}
      />
    </div>
  );
}

function GuideRow({
  line,
  qty,
  par,
  onHand,
  suggestion,
  countMode,
  canOrder,
  canEditPar,
  onQty,
  onKeypad,
}: {
  line: GuideLine;
  qty: number;
  par: number | null;
  onHand: number | null;
  suggestion: number;
  countMode: boolean;
  canOrder: boolean;
  canEditPar: boolean;
  onQty: (v: number) => void;
  onKeypad: (field: Field) => void;
}) {
  const s = line.stats;
  const belowPar = par !== null && onHand !== null && onHand < par;
  const meta: string[] = [];
  if (s) {
    meta.push(`di solito ${formatQty(s.typicalQty)} ${line.unit}`);
    if (s.intervalDays) meta.push(`ogni ~${s.intervalDays} gg`);
    meta.push(s.daysSinceLast === 0 ? "ordinato oggi" : `ultimo ${s.daysSinceLast} gg fa`);
  } else {
    meta.push("scorta minima impostata");
  }
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-medium text-[var(--f-ink)]">{line.name}</span>
          {!line.offer ? (
            <StatusPill tone="neutral">non più a listino</StatusPill>
          ) : s?.due || belowPar ? (
            <StatusPill tone="warning" dot>
              da riordinare
            </StatusPill>
          ) : null}
        </div>
        <p className="mt-0.5 text-[12px] text-[var(--f-muted)]">
          {line.offer ? (
            <>
              <span className="font-medium tabular-nums text-[var(--f-ink-2)]">
                {formatCurrency(line.offer.price)}/{line.unit}
              </span>
              {s && s.avgPricePaid > 0 && Math.abs(line.offer.price - s.avgPricePaid) / s.avgPricePaid > 0.02 && (
                <span className={line.offer.price > s.avgPricePaid ? "text-[var(--f-danger)]" : "text-[var(--f-success)]"}>
                  {" "}
                  ({line.offer.price > s.avgPricePaid ? "+" : "−"}
                  {Math.abs(Math.round(((line.offer.price - s.avgPricePaid) / s.avgPricePaid) * 100))}% vs pagato)
                </span>
              )}
              {" · "}
            </>
          ) : null}
          {meta.join(" · ")}
        </p>
        {countMode && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
            <button
              type="button"
              onClick={() => onKeypad("onHand")}
              className="f-btn f-btn-xs f-btn-outline tabular-nums"
              aria-label={`Giacenza ${line.name}`}
            >
              in magazzino: {onHand === null ? "—" : `${formatQty(onHand)} ${line.unit}`}
            </button>
            <button
              type="button"
              disabled={!canEditPar}
              onClick={() => onKeypad("par")}
              className="f-btn f-btn-xs f-btn-outline tabular-nums disabled:opacity-60"
              aria-label={`Scorta minima ${line.name}`}
            >
              min: {par === null ? "—" : `${formatQty(par)} ${line.unit}`}
            </button>
            {par !== null && onHand !== null && (
              <span className={belowPar ? "font-medium text-[var(--f-warning)]" : "text-[var(--f-muted)]"}>
                {belowPar ? `mancano ${formatQty(par - onHand)} ${line.unit}` : "scorta ok"}
              </span>
            )}
          </div>
        )}
      </div>
      {canOrder && line.offer && (
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {qty === 0 && suggestion > 0 && (
            <button
              type="button"
              onClick={() => onQty(suggestion)}
              className="f-btn f-btn-xs f-btn-ghost tabular-nums text-[var(--acc-700)]"
              title="Usa il suggerito"
            >
              <Sparkles className="h-3 w-3" /> {formatQty(suggestion)}
            </button>
          )}
          <QtyStepper
            value={qty}
            unit={line.unit}
            step={stepFor(line.unit)}
            onChange={onQty}
            onOpenKeypad={() => onKeypad("qty")}
          />
        </div>
      )}
    </li>
  );
}
