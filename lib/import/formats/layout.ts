// Rebuild rows and columns from positioned text (PDF text layer, OCR words).
// Pure: coordinates are top-down (y grows downwards), any unit.

export type PositionedText = {
  text: string;
  x: number;
  /** top of the glyph box */
  y: number;
  w: number;
  h: number;
};

type Cell = { text: string; x0: number; x1: number };
type Line = { y: number; h: number; cells: Cell[] };

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Group items into visual lines, then into cells split by large gaps. */
export function groupLines(items: PositionedText[]): Line[] {
  const clean = items
    .map((i) => ({ ...i, text: i.text.replace(/\s+/g, " ") }))
    .filter((i) => i.text.trim() && i.w >= 0 && i.h > 0);
  if (clean.length === 0) return [];
  const medH = median(clean.map((i) => i.h)) || 1;
  const sorted = [...clean].sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2) || a.x - b.x);

  const lines: Array<{ yc: number; items: PositionedText[] }> = [];
  for (const it of sorted) {
    const yc = it.y + it.h / 2;
    const last = lines[lines.length - 1];
    if (last && Math.abs(yc - last.yc) <= medH * 0.55) {
      last.items.push(it);
      last.yc = (last.yc * (last.items.length - 1) + yc) / last.items.length;
    } else {
      lines.push({ yc, items: [it] });
    }
  }

  return lines.map((l) => {
    const its = l.items.sort((a, b) => a.x - b.x);
    const h = median(its.map((i) => i.h)) || medH;
    const cells: Cell[] = [];
    let cur: Cell | null = null;
    let prevCharW = h * 0.5;
    for (const it of its) {
      const t = it.text;
      const charW = t.trim().length > 0 ? it.w / Math.max(1, t.length) : prevCharW;
      if (!cur) {
        cur = { text: t.trim(), x0: it.x, x1: it.x + it.w };
      } else {
        const gap = it.x - cur.x1;
        const cw = Math.max(prevCharW, charW, h * 0.3);
        if (gap > Math.max(cw * 2.4, h * 1.1)) {
          cells.push(cur);
          cur = { text: t.trim(), x0: it.x, x1: it.x + it.w };
        } else {
          const sep = gap > cw * 0.25 || /\s$/.test(cur.text) || /^\s/.test(t) ? " " : "";
          cur.text = `${cur.text}${sep}${t.trim()}`.replace(/\s+/g, " ");
          cur.x1 = Math.max(cur.x1, it.x + it.w);
        }
      }
      prevCharW = charW || prevCharW;
    }
    if (cur) cells.push(cur);
    return { y: l.yc, h, cells: cells.filter((c) => c.text) };
  });
}

/**
 * Column bands from the x-intervals of cells across lines. Rows with a single
 * cell (titles, notes) and very wide cells don't define columns.
 */
function columnBands(lines: Line[], pageWidth: number): Array<[number, number]> {
  const intervals: Array<[number, number]> = [];
  for (const l of lines) {
    if (l.cells.length < 2) continue;
    for (const c of l.cells) {
      if (c.x1 - c.x0 > pageWidth * 0.55) continue;
      intervals.push([c.x0, c.x1]);
    }
  }
  if (intervals.length === 0) return [];
  intervals.sort((a, b) => a[0] - b[0]);
  const bands: Array<[number, number, number]> = []; // start, end, support
  for (const [s, e] of intervals) {
    const last = bands[bands.length - 1];
    if (last && s <= last[1]) {
      last[1] = Math.max(last[1], e);
      last[2]++;
    } else {
      bands.push([s, e, 1]);
    }
  }
  const multi = lines.filter((l) => l.cells.length >= 2).length;
  return bands.filter((b) => b[2] >= Math.max(2, multi * 0.08)).map((b) => [b[0], b[1]]);
}

/**
 * Turn positioned text into rows of cells aligned on shared columns, so a
 * columnar price list becomes a table. Returns plain rows when no stable
 * columns exist.
 */
export function reconstructRows(items: PositionedText[], pageWidth?: number): string[][] {
  const lines = groupLines(items);
  if (lines.length === 0) return [];
  const width = pageWidth ?? Math.max(...lines.flatMap((l) => l.cells.map((c) => c.x1)));
  const bands = columnBands(lines, width);
  if (bands.length < 2) return lines.map((l) => l.cells.map((c) => c.text));

  return lines.map((l) => {
    if (l.cells.length === 1 && l.cells[0]!.x1 - l.cells[0]!.x0 > width * 0.55) {
      return [l.cells[0]!.text];
    }
    const row: string[] = new Array(bands.length).fill("");
    for (const c of l.cells) {
      let best = -1;
      let bestOverlap = -Infinity;
      bands.forEach(([s, e], i) => {
        const overlap = Math.min(e, c.x1) - Math.max(s, c.x0);
        const dist = overlap > 0 ? overlap : -Math.min(Math.abs(c.x0 - e), Math.abs(s - c.x1));
        if (dist > bestOverlap) {
          bestOverlap = dist;
          best = i;
        }
      });
      row[best] = row[best] ? `${row[best]} ${c.text}` : c.text;
    }
    // drop trailing empty cells to keep rows compact
    while (row.length > 1 && !row[row.length - 1]) row.pop();
    return row;
  });
}
