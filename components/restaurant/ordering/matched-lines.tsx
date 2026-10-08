"use client";

// Review table for a parsed shopping list: each written line → chosen offer
// (alternatives in a select), quantity stepper, unit warnings, unmatched lines.

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatters";
import { normalizedUnitPrice } from "@/lib/restaurants/ordering/units";
import type { Offer } from "@/lib/restaurants/ordering/types";
import type { MatchedLine } from "./use-list-matcher";
import { KeypadModal, QtyStepper } from "./qty-keypad";

export type LineChoice = { candidate: number | null; qty: number | null };

export function lineKey(m: MatchedLine, i: number): string {
  return `${i}:${m.line.raw}`;
}

/** Offer + quantity currently chosen for a matched line (null = skipped / unmatched). */
export function chosen(m: MatchedLine, c: LineChoice | undefined): { offer: Offer; qty: number } | null {
  const idx = c?.candidate === undefined ? 0 : c.candidate;
  if (idx === null) return null;
  const cand = m.candidates[idx];
  if (!cand) return null;
  return { offer: cand.offer.source, qty: c?.qty ?? cand.qty };
}

export function MatchedLines({
  matched,
  choices,
  onChoice,
  disabled = false,
}: {
  matched: MatchedLine[];
  choices: Record<string, LineChoice>;
  onChoice: (key: string, c: LineChoice) => void;
  disabled?: boolean;
}) {
  const [keypad, setKeypad] = useState<{
    key: string;
    candidate: number | null;
    title: string;
    unit: string;
    initial: number;
  } | null>(null);
  return (
    <>
    <KeypadModal
      open={keypad !== null}
      title={keypad?.title ?? ""}
      subtitle={keypad ? `Unità: ${keypad.unit}` : undefined}
      initial={keypad?.initial ?? 0}
      onClose={() => setKeypad(null)}
      onConfirm={(v) => {
        if (keypad) onChoice(keypad.key, { candidate: keypad.candidate, qty: v });
        setKeypad(null);
      }}
    />
    <ul className="divide-y divide-[var(--f-line)]">
      {matched.map((m, i) => {
        const key = lineKey(m, i);
        const c = choices[key];
        const pick = chosen(m, c);
        const candIdx = c?.candidate === undefined ? 0 : c.candidate;
        const cand = candIdx !== null ? m.candidates[candIdx] : undefined;
        const unitPrice = pick ? normalizedUnitPrice(pick.offer.packName, pick.offer.unit, pick.offer.price) : null;
        return (
          <li key={key} className="flex flex-col gap-2 py-3 lg:flex-row lg:items-center lg:gap-4">
            <div className="min-w-0 lg:w-[30%]">
              <p className="truncate text-[13px] text-[var(--f-muted)]">“{m.line.raw}”</p>
              {m.candidates.length === 0 ? (
                <p className="mt-0.5 flex items-center gap-1.5 text-[14px] font-medium text-[var(--f-warning)]">
                  <AlertTriangle className="h-4 w-4" /> Nessun prodotto trovato
                </p>
              ) : null}
            </div>
            {m.candidates.length === 0 ? (
              <Link href={`/cerca?q=${encodeURIComponent(m.line.text)}`} className="f-btn f-btn-sm f-btn-outline self-start">
                <Search className="h-3.5 w-3.5" /> Cerca “{m.line.text}”
              </Link>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <select
                    className="f-input h-11 w-full px-3 text-[14px]"
                    value={candIdx === null ? "skip" : String(candIdx)}
                    disabled={disabled}
                    onChange={(e) =>
                      onChoice(key, {
                        candidate: e.target.value === "skip" ? null : Number(e.target.value),
                        qty: null,
                      })
                    }
                    aria-label={`Prodotto per “${m.line.raw}”`}
                  >
                    {m.candidates.map((cd, ci) => (
                      <option key={cd.offer.key} value={ci}>
                        {cd.offer.source.name} — {cd.offer.supplierName} · {formatCurrency(cd.offer.price)}/{cd.offer.unit}
                        {cd.offer.timesOrdered > 0 ? " · già ordinato" : ""}
                      </option>
                    ))}
                    <option value="skip">Non ordinare questa riga</option>
                  </select>
                  {pick && (
                    <p className="mt-1 text-[12px] text-[var(--f-muted)]">
                      {unitPrice && unitPrice.measure !== "pz"
                        ? `${formatCurrency(unitPrice.price)}/${unitPrice.measure} · `
                        : ""}
                      riga {formatCurrency(pick.offer.price * pick.qty)}
                      {cand?.unitNote ? <span className="text-[var(--f-warning)]"> · {cand.unitNote}</span> : null}
                    </p>
                  )}
                </div>
                {pick && (
                  <QtyStepper
                    value={pick.qty}
                    unit={pick.offer.unit}
                    size="sm"
                    disabled={disabled}
                    step={pick.offer.unit === "kg" || pick.offer.unit === "l" ? 0.5 : 1}
                    onChange={(v) => onChoice(key, { candidate: candIdx, qty: v })}
                    onOpenKeypad={() =>
                      setKeypad({ key, candidate: candIdx, title: pick.offer.name, unit: pick.offer.unit, initial: pick.qty })
                    }
                  />
                )}
              </>
            )}
          </li>
        );
      })}
    </ul>
    </>
  );
}
