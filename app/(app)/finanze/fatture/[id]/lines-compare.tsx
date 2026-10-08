"use client";

import { compareLine, type LineComparison } from "@/lib/invoices/compare";
import type { InvoiceDetail } from "@/lib/invoices/server/queries";
import { cn } from "@/lib/utils/formatters";

const eur = new Intl.NumberFormat("it-IT", { useGrouping: "always", style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const eur2 = new Intl.NumberFormat("it-IT", { useGrouping: "always", style: "currency", currency: "EUR" });
const qty = new Intl.NumberFormat("it-IT", { useGrouping: "always", maximumFractionDigits: 3 });

const SOURCE_LABEL: Record<string, string> = { order: "ordine", catalog: "tuo catalogo", listino: "listino" };

type Line = InvoiceDetail["lines"][number];

function Cell({
  children,
  diff = false,
  muted = false,
  label,
}: {
  children: React.ReactNode;
  diff?: boolean;
  muted?: boolean;
  label: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-[10px] px-2.5 py-2 text-[13px] tabular-nums",
        diff ? "bg-[var(--f-danger-bg)] text-[var(--f-danger)]" : "bg-[var(--f-fill)] text-[var(--f-ink)]",
        muted && "text-[var(--f-faint)]",
      )}
    >
      <p className={cn("mb-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em]", diff ? "text-[var(--f-danger)]/80" : "text-[var(--f-muted)]")}>
        {label}
      </p>
      {children}
    </div>
  );
}

function unitOf(l: Line): string {
  return (l.unit ?? "").toLowerCase() || "pz";
}

function Row({ line, cmp, ctx }: { line: Line; cmp: LineComparison; ctx: { orderedName: string | null; lots: string[] } | null }) {
  const u = unitOf(line);
  const isGoods = line.kind === "goods";
  return (
    <li className={cn("py-3", cmp.tone === "diff" && "relative")}>
      <div className="mb-2 flex items-start gap-2">
        <span className="mt-0.5 w-6 shrink-0 text-right text-[11px] tabular-nums text-[var(--f-faint)]">{line.line_number}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium leading-snug text-[var(--f-ink)]">{line.description || "—"}</p>
          {ctx?.orderedName && ctx.orderedName.toLowerCase() !== line.description.toLowerCase() && (
            <p className="text-[12px] text-[var(--f-muted)]">Nell&apos;ordine: {ctx.orderedName}</p>
          )}
          {line.note && <p className="text-[12px] text-[var(--f-warning)]">{line.note}</p>}
        </div>
        {cmp.impactCents > 0 ? (
          <span className="shrink-0 rounded-full bg-[var(--f-danger-bg)] px-2.5 py-0.5 text-[12.5px] font-semibold tabular-nums text-[var(--f-danger)]">
            +{eur2.format(cmp.impactCents / 100)}
          </span>
        ) : cmp.settled ? (
          <span className="shrink-0 text-[12px] text-[var(--f-success)]">Sistemata</span>
        ) : null}
      </div>
      {isGoods || line.total_price !== 0 ? (
        <div className="grid grid-cols-1 gap-1.5 pl-8 sm:grid-cols-3">
          <Cell label={cmp.ordered?.source && cmp.ordered.source !== "order" ? `Prezzo ${SOURCE_LABEL[cmp.ordered.source]}` : "Ordine"} muted={!cmp.ordered} diff={false}>
            {cmp.ordered ? (
              <>
                {cmp.ordered.qty !== null ? `${qty.format(cmp.ordered.qty)} ${u} × ` : ""}
                {cmp.ordered.price !== null ? `${eur.format(cmp.ordered.price)}/${u}` : "prezzo n.d."}
              </>
            ) : cmp.notOrdered ? (
              <span className="text-[var(--f-danger)]">Non ordinato</span>
            ) : (
              "Nessun ordine collegato"
            )}
          </Cell>
          <Cell label={cmp.delivered?.ddt ? `DDT ${cmp.delivered.ddt}` : "Ricevuto"} muted={!cmp.delivered || cmp.delivered.qty === null}>
            {cmp.delivered && cmp.delivered.qty !== null ? `${qty.format(cmp.delivered.qty)} ${u}` : "Controllo merce non registrato"}
            {ctx && ctx.lots.length > 0 && (
              <span className="block text-[11.5px] text-[var(--f-muted)]">Lotto {ctx.lots.slice(0, 2).join(", ")}</span>
            )}
          </Cell>
          <Cell label="Fattura" diff={cmp.priceDiff || cmp.qtyDiff || cmp.notOrdered}>
            <span className={cn(cmp.qtyDiff && "font-semibold underline decoration-dotted underline-offset-2")}>
              {cmp.invoiced.qty !== null ? `${qty.format(cmp.invoiced.qty)} ${u}` : "—"}
            </span>
            {" × "}
            <span className={cn(cmp.priceDiff && "font-semibold underline decoration-dotted underline-offset-2")}>{eur.format(cmp.invoiced.price)}</span>
            <span className="block text-[11.5px] opacity-80">= {eur2.format(cmp.invoiced.total)}</span>
          </Cell>
        </div>
      ) : null}
    </li>
  );
}

/** Side-by-side ordine ↔ DDT/ricevuto ↔ fattura, differences highlighted. */
export function LinesCompare({ detail, onlyDiffs }: { detail: InvoiceDetail; onlyDiffs: boolean }) {
  const rows = detail.lines
    .filter((l) => l.kind !== "note" || l.total_price !== 0)
    .map((l) => ({ line: l, cmp: compareLine(l, detail.findings) }))
    .filter((r) => !onlyDiffs || r.cmp.tone === "diff");
  if (rows.length === 0) {
    return <p className="py-4 text-center text-[13px] text-[var(--f-muted)]">Nessuna riga con differenze.</p>;
  }
  return (
    <ul className="divide-y divide-[var(--f-line)]">
      {rows.map(({ line, cmp }) => (
        <Row key={line.id} line={line} cmp={cmp} ctx={line.order_line_ref ? detail.lineContext[line.order_line_ref] ?? null : null} />
      ))}
    </ul>
  );
}
