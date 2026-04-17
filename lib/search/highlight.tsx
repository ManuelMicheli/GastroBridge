// lib/search/highlight.tsx
import type { ReactNode } from "react";
import { normalizeName } from "@/lib/catalogs/normalize";

/**
 * Highlight every token from `query` inside `text` with <mark>.
 * Matching is accent-insensitive + case-insensitive by normalizing both sides.
 */
export function highlight(text: string, query: string): ReactNode {
  const q = normalizeName(query);
  if (!q) return text;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return text;

  const normText = normalizeName(text);
  // Map normalized positions back to raw text. Because normalizeName only
  // removes diacritics and punctuation (one-char-per-char or drop), we can
  // scan raw text char-by-char and keep a parallel index into the normalized
  // string.
  const marks: Array<[number, number]> = []; // [startRaw, endRaw)

  for (const t of tokens) {
    let from = 0;
    while (from <= normText.length - t.length) {
      const idx = normText.indexOf(t, from);
      if (idx < 0) break;
      marks.push(mapNormRangeToRaw(text, idx, idx + t.length));
      from = idx + t.length;
    }
  }
  if (marks.length === 0) return text;

  marks.sort((a, b) => a[0] - b[0]);
  // Merge overlaps
  const merged: Array<[number, number]> = [];
  for (const m of marks) {
    const last = merged[merged.length - 1];
    if (last && m[0] <= last[1]) last[1] = Math.max(last[1], m[1]);
    else merged.push([m[0], m[1]]);
  }

  const out: ReactNode[] = [];
  let cursor = 0;
  merged.forEach(([s, e], i) => {
    if (s > cursor) out.push(text.slice(cursor, s));
    out.push(
      <mark
        key={i}
        className="rounded-sm bg-yellow-500/20 text-text-primary px-0.5"
      >
        {text.slice(s, e)}
      </mark>,
    );
    cursor = e;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return <>{out}</>;
}

function mapNormRangeToRaw(
  raw: string,
  normStart: number,
  normEnd: number,
): [number, number] {
  let ni = 0;
  let rawStart = 0;
  let rawEnd = raw.length;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!;
    const normChunk = normalizeName(ch);
    if (ni === normStart) rawStart = i;
    ni += normChunk.length;
    if (ni >= normEnd) {
      rawEnd = i + 1;
      break;
    }
  }
  return [rawStart, rawEnd];
}
