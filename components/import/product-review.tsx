"use client";

import { memo, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Brain, Check, ChevronDown, Pencil, Plus, Search, X } from "lucide-react";
import { Chips } from "@/components/fernly/chips";
import { StatusPill } from "@/components/fernly/primitives";
import { cn } from "@/lib/utils/formatters";
import { CATEGORY_LABELS, IMPORT_CATEGORIES, type ImportCategory } from "@/lib/import/lexicon/categories";
import { ALL_SALE_UNITS, SALE_UNIT_LABELS } from "@/lib/import/parse/units";
import type { SaleUnit } from "@/lib/import/types";
import {
  confidenceLabel,
  confidenceTone,
  formatPrice,
  needsReview,
  parsePriceInput,
  unitPriceOf,
  type ReviewItem,
} from "./review-model";

export type RowAnnotation = {
  kind: "new" | "increased" | "decreased" | "unchanged" | "match";
  delta?: number | null;
  pct?: number | null;
  existingName?: string;
  existingPrice?: number;
};

type Filter = "all" | "review" | "excluded" | "changes";

const PAGE = 40;

export function ProductReview({
  items,
  onChange,
  annotations,
}: {
  items: ReviewItem[];
  onChange: (next: ReviewItem[]) => void;
  annotations?: Record<string, RowAnnotation>;
}) {
  const [filter, setFilter] = useState<Filter>(() => (items.some(needsReview) ? "review" : "all"));
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<string | null>(null);

  const counts = useMemo(() => {
    let review = 0, excluded = 0, changes = 0;
    for (const i of items) {
      if (needsReview(i) && i.included) review++;
      if (!i.included) excluded++;
      const a = annotations?.[i.id];
      if (a && a.kind !== "unchanged" && a.kind !== "match") changes++;
    }
    return { all: items.length, review, excluded, changes };
  }, [items, annotations]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (filter === "review" && !(needsReview(i) && i.included)) return false;
      if (filter === "excluded" && i.included) return false;
      if (filter === "changes") {
        const a = annotations?.[i.id];
        if (!a || a.kind === "unchanged" || a.kind === "match") return false;
      }
      if (q && !i.name.toLowerCase().includes(q) && !i.original.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, filter, query, annotations]);

  const groups = useMemo(() => {
    const m = new Map<ImportCategory, ReviewItem[]>();
    for (const i of visible) {
      const list = m.get(i.category) ?? [];
      list.push(i);
      m.set(i.category, list);
    }
    return IMPORT_CATEGORIES.filter((c) => m.has(c)).map((c) => ({ category: c, items: m.get(c)! }));
  }, [visible]);

  const update = (id: string, patch: Partial<ReviewItem>) => {
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };
  const bulk = (fn: (i: ReviewItem) => ReviewItem) => onChange(items.map(fn));

  return (
    <section className="flex flex-col gap-4" aria-label="Prodotti riconosciuti">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Chips
          ariaLabel="Filtra prodotti"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Tutti", count: counts.all },
            { value: "review", label: "Da controllare", count: counts.review },
            ...(annotations ? [{ value: "changes" as const, label: "Cambiamenti", count: counts.changes }] : []),
            { value: "excluded", label: "Esclusi", count: counts.excluded },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative flex h-9 items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--f-muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca prodotto"
              aria-label="Cerca prodotto"
              className="h-9 w-[180px] rounded-full border border-[var(--f-line)] bg-[var(--f-card)] pl-9 pr-3 text-[13px] outline-none focus:border-[var(--acc-600)]"
            />
          </label>
          {counts.review > 0 ? (
            <button
              type="button"
              className="f-btn f-btn-outline f-btn-sm"
              onClick={() => bulk((i) => (needsReview(i) && i.price !== null ? { ...i, accepted: true } : i))}
              title="Segna come verificati tutti i prodotti con un prezzo"
            >
              <Check className="h-4 w-4" /> Accetta tutti
            </button>
          ) : null}
          {counts.review > 0 ? (
            <button type="button" className="f-btn f-btn-ghost f-btn-sm" onClick={() => bulk((i) => (needsReview(i) ? { ...i, included: false } : i))}>
              Escludi da controllare
            </button>
          ) : null}
          {counts.excluded > 0 ? (
            <button type="button" className="f-btn f-btn-ghost f-btn-sm" onClick={() => bulk((i) => (i.price !== null ? { ...i, included: true } : i))}>
              Includi tutti
            </button>
          ) : null}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="f-card px-6 py-10 text-center text-[14px] text-[var(--f-muted)]">
          {filter === "review" ? "Niente da controllare: tutto è stato riconosciuto con sicurezza." : "Nessun prodotto con questi filtri."}
        </div>
      ) : (
        groups.map((g) => {
          const open = expanded[g.category] ?? false;
          const shown = open ? g.items : g.items.slice(0, PAGE);
          return (
            <div key={g.category} className="f-card overflow-hidden p-0">
              <header className="flex items-center justify-between border-b border-[var(--f-line)] px-5 py-3">
                <h3 className="text-[14px] font-semibold text-[var(--f-ink)]">
                  {CATEGORY_LABELS[g.category]} <span className="ml-1 font-normal text-[var(--f-muted)] tabular-nums">{g.items.length}</span>
                </h3>
              </header>
              <ul className="divide-y divide-[var(--f-line)]">
                {shown.map((i) => (
                  <ReviewRow
                    key={i.id}
                    item={i}
                    annotation={annotations?.[i.id]}
                    editing={editing === i.id}
                    onEdit={() => setEditing(editing === i.id ? null : i.id)}
                    onUpdate={(patch) => update(i.id, patch)}
                  />
                ))}
              </ul>
              {g.items.length > PAGE ? (
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-1 border-t border-[var(--f-line)] py-2.5 text-[13px] font-medium text-[var(--acc-700)] hover:bg-[var(--f-fill)]"
                  onClick={() => setExpanded((e) => ({ ...e, [g.category]: !open }))}
                >
                  <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
                  {open ? "Mostra meno" : `Mostra tutti (${g.items.length})`}
                </button>
              ) : null}
            </div>
          );
        })
      )}
    </section>
  );
}

const ReviewRow = memo(function ReviewRow({
  item: i,
  annotation: a,
  editing,
  onEdit,
  onUpdate,
}: {
  item: ReviewItem;
  annotation?: RowAnnotation;
  editing: boolean;
  onEdit: () => void;
  onUpdate: (patch: Partial<ReviewItem>) => void;
}) {
  const flagged = needsReview(i) && i.included;
  const up = unitPriceOf(i);
  const tone = i.edited || i.accepted ? "success" : confidenceTone(i.confidence);
  return (
    <li
      className={cn(
        "flex flex-col gap-2 px-5 py-3.5 transition-colors",
        !i.included && "opacity-55",
        flagged && "bg-[color:color-mix(in_oklab,var(--f-warning)_7%,transparent)]",
      )}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={i.included}
          disabled={i.price === null}
          onChange={(e) => onUpdate({ included: e.target.checked })}
          aria-label={`Includi ${i.name}`}
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--acc-700)]"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[14.5px] font-medium text-[var(--f-ink)]">{i.name || "—"}</span>
            {i.format ? <span className="f-tag bg-[var(--f-fill)] text-[var(--f-ink-2)]">{i.format}</span> : null}
            {i.fromMemory ? (
              <span className="f-tag bg-[var(--acc-50)] text-[var(--acc-700)]" title="Corretto in un import precedente">
                <Brain className="h-3 w-3" /> ricordato
              </span>
            ) : null}
            {!i.available ? <StatusPill tone="danger">Non disponibile</StatusPill> : null}
          </div>
          <p className="mt-0.5 truncate text-[12px] text-[var(--f-faint)]" title={i.original}>
            {i.original}
          </p>
          {i.issues.length > 0 && i.included && !i.accepted && !i.edited ? (
            <ul className="mt-1.5 space-y-0.5">
              {i.issues.slice(0, 3).map((s) => (
                <li key={s} className="flex items-start gap-1.5 text-[12px] text-[var(--f-warning)]">
                  <AlertTriangle className="mt-[2px] h-3 w-3 shrink-0" /> {s}
                </li>
              ))}
            </ul>
          ) : null}
          {i.availability ? <p className="mt-1 text-[12px] text-[var(--f-muted)]">{i.availability}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          <span className="text-[15px] font-semibold tabular-nums text-[var(--f-ink)]">
            {formatPrice(i.price)} <span className="text-[12px] font-normal text-[var(--f-muted)]">/ {SALE_UNIT_LABELS[i.priceUnit]}</span>
          </span>
          {up && up.base !== i.priceUnit ? (
            <span className="text-[11.5px] tabular-nums text-[var(--f-muted)]">
              {formatPrice(up.value)}/{up.base}
            </span>
          ) : null}
          <div className="flex flex-wrap justify-end gap-1">
            {a ? <DiffBadge a={a} /> : null}
            <StatusPill tone={tone} dot>
              {i.edited ? "Modificato" : i.accepted ? "Verificato" : confidenceLabel(i.confidence)}
            </StatusPill>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-7">
        <button type="button" className="f-btn f-btn-ghost f-btn-xs" onClick={onEdit} aria-expanded={editing}>
          <Pencil className="h-3.5 w-3.5" /> {editing ? "Chiudi" : "Modifica"}
        </button>
        {flagged && i.price !== null ? (
          <button type="button" className="f-btn f-btn-soft f-btn-xs" onClick={() => onUpdate({ accepted: true })}>
            <Check className="h-3.5 w-3.5" /> Va bene così
          </button>
        ) : null}
        <span className="text-[11.5px] text-[var(--f-faint)]" title={`${i.fieldConfidence.price.reason} · ${i.fieldConfidence.unit.reason} · ${i.fieldConfidence.category.reason}`}>
          {i.fieldConfidence.unit.reason}
        </span>
      </div>

      {editing ? <RowEditor item={i} onUpdate={onUpdate} /> : null}
    </li>
  );
});

function RowEditor({ item: i, onUpdate }: { item: ReviewItem; onUpdate: (patch: Partial<ReviewItem>) => void }) {
  const [priceText, setPriceText] = useState(i.price !== null ? String(i.price).replace(".", ",") : "");
  return (
    <div className="ml-7 grid gap-3 rounded-xl bg-[var(--f-fill)] p-3 sm:grid-cols-[2fr_1fr_1fr_1fr]">
      <label className="block">
        <span className="f-label">Nome</span>
        <input className="f-input mt-1 h-10" value={i.name} maxLength={160} onChange={(e) => onUpdate({ name: e.target.value, edited: true })} />
      </label>
      <label className="block">
        <span className="f-label">Prezzo €</span>
        <input
          className="f-input mt-1 h-10 tabular-nums"
          inputMode="decimal"
          value={priceText}
          onChange={(e) => {
            setPriceText(e.target.value);
            const n = parsePriceInput(e.target.value);
            onUpdate({ price: n, edited: true, included: n !== null && n > 0 ? i.included || i.price === null : false });
          }}
        />
      </label>
      <label className="block">
        <span className="f-label">Prezzo al/alla</span>
        <select className="f-input mt-1 h-10" value={i.priceUnit} onChange={(e) => onUpdate({ priceUnit: e.target.value as SaleUnit, edited: true })}>
          {ALL_SALE_UNITS.map((u) => (
            <option key={u} value={u}>{SALE_UNIT_LABELS[u]}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="f-label">Categoria</span>
        <select className="f-input mt-1 h-10" value={i.category} onChange={(e) => onUpdate({ category: e.target.value as ImportCategory, edited: true })}>
          {IMPORT_CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

function DiffBadge({ a }: { a: RowAnnotation }) {
  if (a.kind === "new") {
    return (
      <span className="f-tag bg-[var(--f-info-bg)] text-[var(--f-info)]">
        <Plus className="h-3 w-3" /> Nuovo
      </span>
    );
  }
  if (a.kind === "unchanged" || a.kind === "match") {
    return <span className="f-tag bg-[var(--f-fill)] text-[var(--f-muted)]" title={a.existingName}>{a.kind === "match" ? "Già a catalogo" : "Invariato"}</span>;
  }
  const upward = a.kind === "increased";
  const pct = a.pct != null ? `${upward ? "+" : ""}${(a.pct * 100).toLocaleString("it-IT", { maximumFractionDigits: 1 })}%` : "";
  return (
    <span
      className={cn("f-tag", upward ? "bg-[var(--f-danger-bg)] text-[var(--f-danger)]" : "bg-[var(--f-success-bg)] text-[var(--f-success)]")}
      title={a.existingPrice != null ? `Prima: ${formatPrice(a.existingPrice)}${a.existingName ? ` (${a.existingName})` : ""}` : undefined}
    >
      {upward ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {a.delta != null ? `${upward ? "+" : ""}${formatPrice(a.delta)}` : ""} {pct}
    </span>
  );
}

export function WarningsList({ warnings, onDismiss }: { warnings: string[]; onDismiss?: () => void }) {
  if (warnings.length === 0) return null;
  return (
    <div className="f-card flex items-start gap-3 border border-[color:color-mix(in_oklab,var(--f-warning)_35%,transparent)] bg-[var(--f-warning-bg)] p-4">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--f-warning)]" />
      <ul className="flex-1 space-y-1 text-[13px] text-[var(--f-ink-2)]">
        {warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} aria-label="Chiudi avvisi" className="rounded-full p-1 text-[var(--f-muted)] hover:bg-[var(--f-fill)]">
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
