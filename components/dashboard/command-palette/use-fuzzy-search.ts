export type SearchItem = {
  id: string;
  label: string;
  section: string;
  href?: string;
  icon?: string;
  keywords?: string[];
};

function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  if (t === q) return 100;
  if (t.startsWith(q)) return 90;
  if (t.includes(q)) return 70;

  // Character-by-character fuzzy match
  let qi = 0;
  let score = 0;
  let lastMatchIdx = -1;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 10;
      // Bonus for consecutive matches
      if (lastMatchIdx === ti - 1) score += 5;
      // Bonus for matching at word boundary
      if (ti === 0 || t[ti - 1] === " ") score += 8;
      lastMatchIdx = ti;
      qi++;
    }
  }

  // All query chars must match
  if (qi < q.length) return 0;

  return score;
}

export function useFuzzySearch(items: SearchItem[], query: string): SearchItem[] {
  if (!query.trim()) return [];

  const scored = items
    .map((item) => {
      const labelScore = fuzzyScore(query, item.label);
      const keywordScore = item.keywords
        ? Math.max(...item.keywords.map((k) => fuzzyScore(query, k)))
        : 0;
      return { item, score: Math.max(labelScore, keywordScore) };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 8).map((r) => r.item);
}
