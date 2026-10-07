// Local, deterministic extraction engine (no external services).
//
//   SourceDoc ──► supplier pass (classify header/footer/text lines)
//             ──► memory lookup (per supplier)
//             ──► product pass (table strategy or line strategy per sheet)
//             ──► dedupe, confidence, warnings
//
// `localExtractor` implements the `Extractor` strategy from types.ts.

import type {
  ColumnRole,
  ExtractedProduct,
  ExtractionContext,
  ExtractionResult,
  ExtractionStats,
  Extractor,
  ImportHints,
  RawSheet,
  SaleUnit,
  SourceDoc,
} from "./types.ts";
import { emptyHints, REVIEW_THRESHOLD } from "./types.ts";
import { cleanLine, parseEmailHeader, stripChatPrefix } from "./text.ts";
import { classifyLine, type LineClass } from "./understand/classify.ts";
import { parseProductText, type ParsedText } from "./understand/product-line.ts";
import { buildProduct, type BuildContext, type BuildExtra } from "./understand/build-product.ts";
import { buildSupplier, type SupplierEvidence } from "./understand/supplier.ts";
import {
  basisFromHeader,
  choosePriceColumn,
  detectHeader,
  headerSignature,
  inferRolesFromContent,
} from "./understand/table.ts";
import { findMoney, findVat, parseNumber } from "./parse/numbers.ts";
import { parsePack, unitFromWord } from "./parse/units.ts";
import { categoryFromHeading, type ImportCategory } from "./lexicon/categories.ts";
import { findAvailability, isNoiseText } from "./lexicon/misc.ts";
import { dedupeProducts } from "./match/dedupe.ts";
import { NameIndex } from "./match/similarity.ts";
import { emptySupplier, hasLegalForm, nameFromEmailHeader, supplierSignals } from "./parse/supplier-info.ts";

export const MAX_ROWS = 20_000;
export const MAX_PRODUCTS = 5_000;

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

// ---------------------------------------------------------------------------
// Line preparation (text & grid sheets)
// ---------------------------------------------------------------------------

type PreparedLine = { text: string; raw: string; row: number };

type TextPrep = {
  lines: PreparedLine[];
  chatSenders: string[];
  emailFromNames: string[];
  emailFromAddresses: string[];
  signature: string[];
};

const SEGMENT_SPLIT = /;\s*|,\s+(?=[A-Za-zÀ-ú])|\s+\/\s+(?=[A-Za-zÀ-ú]{3})/;

/** Split "Rossi ortofrutta, consegna lun-gio, minimo 100€, pomodori 3,20€/kg". */
function splitCompound(line: string): string[] {
  const parts = line.split(SEGMENT_SPLIT).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return [line];
  const cls = parts.map((p) => classifyLine(p));
  const withPrice = cls.filter((c) => c.features.decimalsCount > 0 || c.features.hasEuro).length;
  const supplierParts = cls.filter((c) => c.cls === "supplier").length;
  const productParts = cls.filter((c) => c.cls === "product").length;
  if (withPrice >= 2 || (supplierParts >= 1 && productParts >= 1)) return parts;
  return [line];
}

function prepareTextSheet(sheet: RawSheet): TextPrep {
  const out: TextPrep = { lines: [], chatSenders: [], emailFromNames: [], emailFromAddresses: [], signature: [] };
  let inSignature = false;
  let inQuotedHeader = false;
  sheet.rows.forEach((cells, row) => {
    let raw = cells.filter(Boolean).join("   ");
    const chat = stripChatPrefix(raw);
    if (chat.sender) {
      out.chatSenders.push(chat.sender);
      raw = chat.text;
    }
    const header = parseEmailHeader(raw);
    if (header) {
      if (header.key === "da" || header.key === "from") {
        const n = nameFromEmailHeader(header.value);
        if (n) out.emailFromNames.push(n);
        const em = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.exec(header.value);
        if (em) out.emailFromAddresses.push(em[0]);
      }
      inQuotedHeader = true;
      return;
    }
    if (inQuotedHeader && !raw.trim()) {
      inQuotedHeader = false;
      return;
    }
    if (/^\s*(--\s*|__+|cordiali saluti|distinti saluti|saluti)\s*,?\s*$/i.test(raw)) {
      inSignature = true;
      return;
    }
    const text = cleanLine(raw);
    if (!text) return;
    if (inSignature) {
      out.signature.push(text);
      return;
    }
    for (const seg of splitCompound(text)) out.lines.push({ text: seg, raw, row });
  });
  return out;
}

// ---------------------------------------------------------------------------
// The extractor
// ---------------------------------------------------------------------------

async function extract(doc: SourceDoc, ctx: ExtractionContext): Promise<ExtractionResult> {
  const progress = ctx.onProgress ?? (() => {});
  const warnings: string[] = [];
  const stats: ExtractionStats = {
    rowsRead: 0, productLines: 0, supplierLines: 0, headerLines: 0, noiseLines: 0, sectionLines: 0,
    duplicatesMerged: 0, needsReview: 0, strategies: [],
  };
  const layouts: ExtractionResult["layouts"] = [];
  const ocr = doc.kind === "image" || (doc.meta?.ocrPages ?? 0) > 0;
  let pricesIncludeVat: boolean | null = null;

  progress({ stage: "reading", progress: 0.02, message: "Lettura del documento" });

  // Bound the work without silently dropping data.
  let totalRows = 0;
  const sheets: RawSheet[] = [];
  for (const sh of doc.sheets) {
    const rows = sh.rows
      .map((r) => Array.from(r, (c) => String(c ?? "").trim()))
      .filter((r) => r.some(Boolean));
    if (totalRows + rows.length > MAX_ROWS) {
      const keep = Math.max(0, MAX_ROWS - totalRows);
      warnings.push(`Il documento ha più di ${MAX_ROWS.toLocaleString("it-IT")} righe: lette solo le prime ${MAX_ROWS.toLocaleString("it-IT")}. Dividi il file per importare il resto.`);
      if (keep > 0) sheets.push({ ...sh, rows: rows.slice(0, keep) });
      totalRows = MAX_ROWS;
      break;
    }
    totalRows += rows.length;
    sheets.push({ ...sh, rows });
  }
  stats.rowsRead = totalRows;
  if (doc.meta?.droppedRows) {
    warnings.push(`${doc.meta.droppedRows} righe del file non sono state lette (formato non leggibile).`);
  }
  if (doc.meta?.ocrConfidence !== undefined && doc.meta.ocrConfidence < 0.6) {
    warnings.push("La foto è poco leggibile: controlla con attenzione nomi e prezzi (meglio una foto dritta, a fuoco e ben illuminata).");
  }

  // ---- plan each sheet ---------------------------------------------------
  type Plan =
    | { kind: "table"; sheet: RawSheet; headerIndex: number; roles: Record<number, ColumnRole>; signature: string }
    | { kind: "lines"; sheet: RawSheet; prep: TextPrep };

  const plans: Plan[] = [];
  for (const sheet of sheets) {
    if (sheet.layout === "text") {
      plans.push({ kind: "lines", sheet, prep: prepareTextSheet(sheet) });
      continue;
    }
    // learned layout / user override / header detection
    let headerIndex = -1;
    let roles: Record<number, ColumnRole> | null = null;
    let signature = "";
    const override = ctx.columnOverrides?.[sheet.name];
    const det = detectHeader(sheet.rows);
    if (det) {
      headerIndex = det.index;
      roles = det.roles;
      signature = headerSignature(sheet.rows[det.index]!);
    }
    if (override) {
      roles = override;
    }
    const usable = roles && Object.values(roles).includes("name") && Object.values(roles).includes("price");
    if (sheet.layout === "table" || usable) {
      plans.push({ kind: "table", sheet, headerIndex, roles: roles ?? {}, signature });
    } else {
      // grid without a recognisable header → treat each row as a text line
      const textSheet: RawSheet = { name: sheet.name, layout: "text", rows: sheet.rows.map((r) => [r.join("   ")]) };
      plans.push({ kind: "lines", sheet: textSheet, prep: prepareTextSheet(textSheet) });
    }
  }

  // ---- pass A: supplier evidence ------------------------------------------
  progress({ stage: "supplier", progress: 0.12, message: "Ricerca dei dati del fornitore" });
  const ev: SupplierEvidence = {
    lines: [], otherLines: [], emailFromNames: [], emailFromAddresses: [], chatSenders: [], titleCandidates: [],
    fileName: doc.fileName,
  };
  const lineClasses = new Map<Plan, LineClass[]>();
  for (const plan of plans) {
    if (plan.kind === "lines") {
      const { prep } = plan;
      ev.chatSenders.push(...prep.chatSenders);
      ev.emailFromNames.push(...prep.emailFromNames);
      ev.emailFromAddresses.push(...prep.emailFromAddresses);
      ev.lines.push(...prep.signature);
      const classes: LineClass[] = [];
      let seenProduct = false;
      for (const l of prep.lines) {
        const c = classifyLine(l.text);
        classes.push(c.cls);
        if (c.cls === "supplier") ev.lines.push(l.text);
        else if (c.cls !== "product") {
          ev.otherLines.push(l.text);
          if (!seenProduct && (c.cls === "section" || c.cls === "noise") && !isNoiseText(l.text) && l.text.length <= 60 && c.features.words <= 6 && !categoryFromHeading(l.text)) {
            ev.titleCandidates.push(l.text);
          }
        } else {
          seenProduct = true;
          // "Rossi Ortofrutta Srl – listino" glued to a product? rare; still look for legal forms
          if (hasLegalForm(l.text)) ev.lines.push(l.text);
        }
        const v = findVat(l.text);
        if (v && v.included !== null && c.cls !== "product") pricesIncludeVat = v.included;
        if (/prezzi\s+(?:si\s+intendono\s+)?(?:iva\s+)?esclus/i.test(l.text)) pricesIncludeVat = false;
        if (/prezzi\s+(?:si\s+intendono\s+)?(?:iva\s+)?(?:inclus|compres)/i.test(l.text)) pricesIncludeVat = true;
      }
      lineClasses.set(plan, classes);
    } else {
      const rows = plan.sheet.rows;
      const head = plan.headerIndex >= 0 ? rows.slice(0, plan.headerIndex) : rows.slice(0, 8);
      const tail = rows.slice(Math.max(plan.headerIndex + 1, rows.length - 10));
      for (const r of [...head, ...tail]) {
        const t = cleanLine(r.filter(Boolean).join("   "));
        if (!t) continue;
        const sig = supplierSignals(t);
        if (sig.count > 0) ev.lines.push(t);
        else ev.otherLines.push(t);
        if (head.includes(r) && !isNoiseText(t) && t.length <= 60 && findMoney(t).length === 0 && !categoryFromHeading(t)) {
          ev.titleCandidates.push(t);
        }
        if (/prezzi\s+(?:si\s+intendono\s+)?(?:iva\s+)?esclus|\+\s*iva\b/i.test(t)) pricesIncludeVat = false;
        if (/prezzi\s+(?:si\s+intendono\s+)?(?:iva\s+)?(?:inclus|compres)|iva\s+inclusa/i.test(t)) pricesIncludeVat = true;
      }
    }
  }

  let supplier = buildSupplier(ev, null);
  let hints: ImportHints = emptyHints();
  if (ctx.loadHints) {
    try {
      const h = await ctx.loadHints(supplier);
      if (h) {
        hints = h;
        supplier = buildSupplier(ev, h);
      }
    } catch {
      // memory is a bonus: never block an import on it
    }
  }
  // learned column layouts apply to header signatures we have seen before
  for (const plan of plans) {
    if (plan.kind === "table" && plan.signature && hints.columnLayouts[plan.signature] && !ctx.columnOverrides?.[plan.sheet.name]) {
      plan.roles = { ...hints.columnLayouts[plan.signature] };
    }
  }

  const bctx: BuildContext = {
    hints,
    knownIndex: ctx.knownProducts?.length ? new NameIndex(ctx.knownProducts, (k) => k.name) : null,
    ocr,
  };

  // ---- pass B: products ----------------------------------------------------
  progress({ stage: "products", progress: 0.25, message: "Riconoscimento dei prodotti" });
  const products: ExtractedProduct[] = [];
  let skippedByMemory = 0;
  let processed = 0;

  const push = (p: ExtractedProduct | null) => {
    if (!p) {
      skippedByMemory++;
      return;
    }
    products.push(p);
  };

  for (const plan of plans) {
    const sheetCategory = categoryFromHeading(plan.sheet.name);
    if (plan.kind === "lines") {
      stats.strategies.push({ sheet: plan.sheet.name, strategy: "lines" });
      const classes = lineClasses.get(plan) ?? [];
      let section: string | null = null;
      let sectionCategory: ImportCategory | null = sheetCategory;
      const lines = plan.prep.lines;
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i]!;
        let cls = classes[i] ?? "noise";
        processed++;
        if (processed % 300 === 0) {
          progress({ stage: "products", progress: 0.25 + 0.65 * (processed / Math.max(1, totalRows)), message: `Analizzate ${processed} righe` });
          await tick();
        }
        // name on one line, price on the next ("Pomodori datterini" / "€ 3,20 al kg")
        let text = l.text;
        if ((cls === "noise" || cls === "section") && i + 1 < lines.length && classes[i + 1] === "product" && !isNoiseText(text)) {
          const next = parseProductText(lines[i + 1]!.text, { ocr });
          if (next.price !== null && next.nameRaw.replace(/[^a-zà-ú]/gi, "").length < 3 && /[a-zà-ú]{3}/i.test(text) && !categoryFromHeading(text)) {
            text = `${text} ${lines[i + 1]!.text}`;
            cls = "product";
            i++;
          }
        }
        if (cls === "section") {
          stats.sectionLines++;
          section = text.replace(/[:\s]+$/, "");
          sectionCategory = categoryFromHeading(text) ?? sheetCategory;
          continue;
        }
        if (cls === "supplier") { stats.supplierLines++; continue; }
        if (cls === "header") { stats.headerLines++; continue; }
        if (cls === "noise") { stats.noiseLines++; continue; }

        const parsed = parseProductText(text, { ocr });
        if (parsed.price === null && parsed.nameRaw.length < 3) { stats.noiseLines++; continue; }
        stats.productLines++;
        push(buildProduct(parsed, {
          id: `${plan.sheet.name}:${l.row}:${i}`,
          original: text,
          section,
          sectionCategory,
        }, bctx));
      }
    } else {
      const res = await extractTable(plan.sheet, plan.headerIndex, plan.roles, sheetCategory, bctx, stats, warnings, ocr, (n) => {
        processed += n;
        progress({ stage: "products", progress: 0.25 + 0.65 * (processed / Math.max(1, totalRows)), message: `Analizzate ${processed} righe` });
      });
      res.products.forEach(push);
      if (plan.signature) layouts.push({ signature: plan.signature, roles: res.roles });
      stats.strategies.push({ sheet: plan.sheet.name, strategy: res.strategy, columns: res.columnNames });
    }
  }

  progress({ stage: "matching", progress: 0.92, message: "Controllo duplicati" });
  const deduped = dedupeProducts(products);
  stats.duplicatesMerged = deduped.merged;
  let finalProducts = deduped.products;
  if (finalProducts.length > MAX_PRODUCTS) {
    warnings.push(`Trovati ${finalProducts.length} prodotti: importabili al massimo ${MAX_PRODUCTS} per volta. Gli ultimi ${finalProducts.length - MAX_PRODUCTS} sono esclusi.`);
    finalProducts = finalProducts.slice(0, MAX_PRODUCTS);
  }
  stats.needsReview = finalProducts.filter((p) => p.confidence.overall < REVIEW_THRESHOLD).length;

  if (skippedByMemory > 0) warnings.push(`${skippedByMemory} righe ignorate come nei precedenti import.`);
  if (finalProducts.length === 0) {
    warnings.push("Nessun prodotto riconosciuto. Prova con un file più leggibile o incolla il testo del listino.");
  }
  if (deduped.merged > 0) warnings.push(`${deduped.merged} righe duplicate unite.`);
  if (pricesIncludeVat === true) warnings.push("Il documento indica prezzi IVA inclusa.");

  progress({ stage: "done", progress: 1, message: `${finalProducts.length} prodotti riconosciuti` });

  return {
    extractor: localExtractor.id,
    supplier: supplier ?? emptySupplier(),
    products: finalProducts,
    warnings,
    pricesIncludeVat,
    stats,
    layouts,
  };
}

// ---------------------------------------------------------------------------
// Table strategy
// ---------------------------------------------------------------------------

async function extractTable(
  sheet: RawSheet,
  headerIndex: number,
  headerRoles: Record<number, ColumnRole>,
  sheetCategory: ImportCategory | null,
  bctx: BuildContext,
  stats: ExtractionStats,
  warnings: string[],
  ocr: boolean,
  onRows: (n: number) => void,
): Promise<{ products: Array<ExtractedProduct | null>; roles: Record<number, ColumnRole>; strategy: "table" | "lines"; columnNames: Partial<Record<string, ColumnRole>> }> {
  const rows = sheet.rows;
  const headerCells = headerIndex >= 0 ? rows[headerIndex]! : [];
  const data = rows.slice(headerIndex + 1);
  const { roles } = inferRolesFromContent(data.slice(0, 300), headerRoles);

  const colsOf = (role: ColumnRole) => Object.entries(roles).filter(([, r]) => r === role).map(([i]) => Number(i));
  const nameCols = colsOf("name");
  const priceCols = colsOf("price");
  const columnNames: Partial<Record<string, ColumnRole>> = {};
  for (const [i, r] of Object.entries(roles)) columnNames[headerCells[Number(i)] || `Colonna ${Number(i) + 1}`] = r;

  const out: Array<ExtractedProduct | null> = [];

  if (nameCols.length === 0) {
    // No usable columns: fall back to reading each row as text.
    let section: string | null = null;
    let sectionCategory = sheetCategory;
    for (let r = 0; r < data.length; r++) {
      const text = cleanLine(data[r]!.filter(Boolean).join("   "));
      if (!text) continue;
      const c = classifyLine(text);
      if (c.cls === "section") { section = text; sectionCategory = categoryFromHeading(text) ?? sheetCategory; stats.sectionLines++; continue; }
      if (c.cls !== "product") { stats.noiseLines++; continue; }
      const parsed = parseProductText(text, { ocr });
      stats.productLines++;
      out.push(buildProduct(parsed, { id: `${sheet.name}:${r + headerIndex + 1}`, original: text, section, sectionCategory }, bctx));
    }
    return { products: out, roles, strategy: "lines", columnNames };
  }

  const nameCol = nameCols[0]!;
  const { main: priceCol, others: otherPriceCols } = priceCols.length ? choosePriceColumn(headerCells, priceCols) : { main: -1, others: [] as number[] };
  const headerBasis = priceCol >= 0 && headerCells[priceCol] ? basisFromHeader(headerCells[priceCol]!) : null;
  if (otherPriceCols.length > 0 && priceCol >= 0) {
    warnings.push(`Più colonne prezzo nel foglio “${sheet.name}”: usata “${headerCells[priceCol] || `colonna ${priceCol + 1}`}”.`);
  }
  const col = (role: ColumnRole) => colsOf(role)[0] ?? -1;
  const unitCol = col("unit");
  const packCol = col("pack");
  const vatCol = col("vat");
  const codeCol = col("code");
  const brandCol = col("brand");
  const catCol = col("category");
  const originCol = col("origin");
  const minCol = col("minQty");
  const availCol = col("availability");

  let section: string | null = null;
  let sectionCategory = sheetCategory;
  const cell = (row: string[], i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");

  for (let r = 0; r < data.length; r++) {
    const row = data[r]!;
    if (r % 400 === 399) {
      onRows(400);
      await tick();
    }
    const nonEmpty = row.filter((c) => c && c.trim());
    if (nonEmpty.length === 0) continue;
    const nameCell = cell(row, nameCol);
    const priceCell = cell(row, priceCol);

    // Section heading row: a single text cell (often merged), no price.
    if (nonEmpty.length === 1 && !findMoney(nonEmpty[0]!).some((m) => m.decimals || m.euro)) {
      const t = nonEmpty[0]!.trim();
      if (isNoiseText(t) || t.length > 60) { stats.noiseLines++; continue; }
      section = t.replace(/[:\s]+$/, "");
      sectionCategory = categoryFromHeading(t) ?? sheetCategory;
      stats.sectionLines++;
      continue;
    }
    if (!nameCell || !/[a-zà-ú]{2}/i.test(nameCell)) {
      stats.noiseLines++;
      continue;
    }
    if (/^(totale|subtotale|imponibile|tot\.)/i.test(nameCell)) { stats.noiseLines++; continue; }

    // price from its cell, else from anywhere in the row
    let cellPrice: BuildExtra["cellPrice"] = null;
    if (priceCell) {
      const money = findMoney(priceCell).filter((m) => m.value > 0);
      const n = money[0]?.value ?? parseNumber(priceCell);
      if (n !== null && n > 0) {
        cellPrice = { value: Math.round(n * 10000) / 10000, score: 0.95, reason: `Colonna prezzo “${headerCells[priceCol] || "prezzo"}”` };
      }
    }
    // name + pack (+ unit) text through the line parser
    const packCell = cell(row, packCol);
    const unitCell = cell(row, unitCol);
    const text = [nameCell, packCell].filter(Boolean).join("  ");
    const parsed: ParsedText = parseProductText(text, { ocr, noPrice: true });

    if (!cellPrice) {
      // price column empty: maybe the price sits in another cell
      const joined = row.filter((_, i) => i !== nameCol).join("   ");
      const alt = parseProductText(`x ${joined}`, { ocr });
      if (alt.price !== null) cellPrice = { value: alt.price, score: Math.min(alt.priceScore, 0.7), reason: "Prezzo trovato fuori dalla colonna prezzo" };
    }

    let tableUnit: SaleUnit | null = null;
    if (unitCell) {
      tableUnit = unitFromWord(unitCell);
      if (!tableUnit) {
        const p = parsePack(unitCell);
        tableUnit = p.basis ?? p.pack.container ?? p.loneUnit ?? null;
        if (p.format && !parsed.format) {
          parsed.pack = p.pack;
          parsed.format = p.format;
        }
      }
    }

    const vatCell = cell(row, vatCol);
    let vatRate: number | null = null;
    if (vatCell) {
      const v = parseNumber(vatCell.replace("%", ""));
      if (v !== null && [4, 5, 10, 22].includes(v)) vatRate = v;
      else if (v !== null && [0.04, 0.05, 0.1, 0.22].includes(v)) vatRate = Math.round(v * 100);
    }
    const minCell = cell(row, minCol);
    const minVal = minCell ? parseNumber(minCell.replace(/[^\d.,]/g, "")) : null;
    const availCell = cell(row, availCol);
    const av = availCell ? findAvailability(availCell) : null;
    const catCell = cell(row, catCol);

    stats.productLines++;
    out.push(buildProduct(parsed, {
      id: `${sheet.name}:${r + headerIndex + 1}`,
      original: row.filter(Boolean).join(" · "),
      section,
      sectionCategory,
      tableUnit,
      headerBasis,
      cellPrice,
      code: cell(row, codeCol) || null,
      brand: cell(row, brandCol) || null,
      vatRate,
      origin: cell(row, originCol) || null,
      availability: av?.note ?? (availCell || null),
      minQty: minVal ? { value: minVal, unit: unitFromWord(minCell.replace(/[\d.,\s]/g, "")) } : null,
      cellCategory: catCell ? categoryFromHeading(catCell) : null,
    }, bctx));
  }
  onRows(data.length % 400);
  return { products: out, roles, strategy: "table", columnNames };
}

export const localExtractor: Extractor = {
  id: "local-v1",
  extract,
};
