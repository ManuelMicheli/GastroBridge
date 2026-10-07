"use client";

import { useCallback, useMemo } from "react";
import { parseShoppingList, type ParsedLine } from "@/lib/restaurants/ordering/quick-parse";
import { matchLine, toMatchable, type LineMatch, type MatchableOffer } from "@/lib/restaurants/ordering/quick-match";
import type { Offer } from "@/lib/restaurants/ordering/types";

export type MatchedLine = {
  line: ParsedLine;
  candidates: (LineMatch & { offer: MatchableOffer & { source: Offer } })[];
};

/** Tokenize the offers once; returns a function list text → matched lines. */
export function useListMatcher(offers: Offer[], timesOrdered: Record<string, number>) {
  const matchable = useMemo(
    () =>
      toMatchable(
        offers.map((o) => ({
          key: o.key,
          name: o.packName,
          unit: o.unit,
          price: o.price,
          supplierKey: o.supplierKey,
          supplierName: o.supplierName,
          timesOrdered: timesOrdered[o.key] ?? 0,
          source: o,
        })),
      ),
    [offers, timesOrdered],
  );

  return useCallback(
    (text: string): MatchedLine[] =>
      parseShoppingList(text).map((line) => {
        const { candidates } = matchLine(line, matchable, 6);
        return { line, candidates: candidates as MatchedLine["candidates"] };
      }),
    [matchable],
  );
}
