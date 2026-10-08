// lib/invoices/archive.ts
// Turn an uploaded file into FatturaPA XML documents.
//
// Accepted inputs (detected from content, not only from the extension):
//   * .xml                       plain FatturaPA
//   * .xml.p7m / .p7m            CAdES signed envelope (DER or BER)
//   * base64 / PEM .p7m          envelope encoded as text
//   * .zip                       batches, e.g. the bulk download of the
//                                Agenzia delle Entrate "Fatture e Corrispettivi"
//                                portal (also nested zips). Metadata files
//                                ("…_MT_001.xml", root <FileMetadati>) and
//                                notifications are skipped.
//
// Pure module: runs in Node (API route) and in the browser (client-side
// splitting of big zips before upload).

import { unzipSync } from "fflate";
import { base64ToBytes, decodeXmlBytes, latin1, looksLikeBase64 } from "./decode.ts";
import { extractP7mContent, looksLikeP7m, P7mError } from "./p7m.ts";

export type SourceKind = "xml" | "p7m" | "p7m_base64";

export interface ExtractedDocument {
  fileName: string;
  xml: string;
  sourceKind: SourceKind;
  /** Name of the zip the document came from, if any. */
  archive: string | null;
}

export interface SkippedEntry {
  fileName: string;
  reason: string;
}

export interface ExtractResult {
  documents: ExtractedDocument[];
  skipped: SkippedEntry[];
}

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_ENTRIES = 2000;
const MAX_UNZIPPED_BYTES = 200 * 1024 * 1024;

function isZip(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05);
}

function looksLikeXmlText(bytes: Uint8Array): boolean {
  const head = latin1(bytes.subarray(0, Math.min(bytes.length, 512))).replace(/^﻿|^ï»¿/, "").trimStart();
  return head.startsWith("<") || (bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff);
}

/** Root element local name of an XML string (cheap regex, no full parse). */
export function rootElementName(xml: string): string | null {
  const m = /<(?!\?|!)([A-Za-z_][\w.-]*:)?([A-Za-z_][\w.-]*)[\s>/]/.exec(xml);
  return m ? m[2]! : null;
}

const INVOICE_ROOTS = new Set(["FatturaElettronica", "FatturaElettronicaSemplificata"]);

function classifyXml(fileName: string, xml: string): { ok: true } | { ok: false; reason: string } {
  const root = rootElementName(xml);
  if (root && INVOICE_ROOTS.has(root)) return { ok: true };
  if (root === "FileMetadati") return { ok: false, reason: "File metadati SDI (non è una fattura)" };
  if (root && /^(RicevutaConsegna|NotificaScarto|NotificaMancataConsegna|NotificaEsito|AttestazioneTrasmissioneFattura|MetadatiInvioFile)/.test(root)) {
    return { ok: false, reason: "Notifica/ricevuta SDI (non è una fattura)" };
  }
  return { ok: false, reason: root ? `Documento XML non riconosciuto (<${root}>)` : `${fileName}: XML non valido` };
}

function decodeSingle(fileName: string, bytes: Uint8Array, archive: string | null, out: ExtractResult): void {
  try {
    if (looksLikeP7m(bytes)) {
      const inner = extractP7mContent(bytes);
      pushXml(fileName, inner, "p7m", archive, out);
      return;
    }
    if (looksLikeXmlText(bytes)) {
      pushXml(fileName, bytes, "xml", archive, out);
      return;
    }
    if (looksLikeBase64(bytes)) {
      const raw = base64ToBytes(latin1(bytes));
      if (looksLikeP7m(raw)) {
        pushXml(fileName, extractP7mContent(raw), "p7m_base64", archive, out);
        return;
      }
      if (looksLikeXmlText(raw)) {
        pushXml(fileName, raw, "xml", archive, out);
        return;
      }
    }
    out.skipped.push({ fileName, reason: "Formato non riconosciuto (atteso .xml, .p7m o .zip)" });
  } catch (err) {
    const msg = err instanceof P7mError ? err.message : err instanceof Error ? err.message : "errore sconosciuto";
    out.skipped.push({ fileName, reason: `File illeggibile: ${msg}` });
  }
}

function pushXml(fileName: string, bytes: Uint8Array, kind: SourceKind, archive: string | null, out: ExtractResult) {
  const xml = decodeXmlBytes(bytes);
  const cls = classifyXml(fileName, xml);
  if (!cls.ok) {
    out.skipped.push({ fileName, reason: cls.reason });
    return;
  }
  out.documents.push({ fileName, xml, sourceKind: kind, archive });
}

function walkZip(fileName: string, bytes: Uint8Array, out: ExtractResult, depth: number, budget: { bytes: number; entries: number }) {
  if (depth > 3) {
    out.skipped.push({ fileName, reason: "Archivi annidati troppo profondi" });
    return;
  }
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, {
      filter: (f) => {
        budget.entries += 1;
        budget.bytes += f.originalSize;
        if (budget.entries > MAX_ENTRIES || budget.bytes > MAX_UNZIPPED_BYTES) return false;
        const base = f.name.split("/").pop() ?? f.name;
        if (!base || f.name.endsWith("/")) return false;
        if (base.startsWith(".") || f.name.startsWith("__MACOSX/")) return false;
        return true;
      },
    });
  } catch {
    out.skipped.push({ fileName, reason: "Archivio .zip danneggiato o protetto da password" });
    return;
  }
  if (budget.entries > MAX_ENTRIES || budget.bytes > MAX_UNZIPPED_BYTES) {
    out.skipped.push({ fileName, reason: "Archivio troppo grande: dividilo in più file" });
  }
  for (const [name, data] of Object.entries(entries).sort(([a], [b]) => a.localeCompare(b))) {
    const base = name.split("/").pop() ?? name;
    if (isZip(data)) walkZip(base, data, out, depth + 1, budget);
    else decodeSingle(base, data, fileName, out);
  }
}

/** Extract every FatturaPA document contained in an uploaded file. */
export function extractInvoiceDocuments(fileName: string, bytes: Uint8Array): ExtractResult {
  const out: ExtractResult = { documents: [], skipped: [] };
  if (bytes.length === 0) {
    out.skipped.push({ fileName, reason: "File vuoto" });
    return out;
  }
  if (bytes.length > MAX_UPLOAD_BYTES) {
    out.skipped.push({ fileName, reason: "File oltre 25 MB" });
    return out;
  }
  if (isZip(bytes)) walkZip(fileName, bytes, out, 0, { bytes: 0, entries: 0 });
  else decodeSingle(fileName, bytes, null, out);
  return out;
}

/**
 * Split a zip into its raw entries (browser side) so big archives can be
 * uploaded in small batches. Non-zip input is returned as a single entry.
 */
export function splitUpload(fileName: string, bytes: Uint8Array): Array<{ name: string; bytes: Uint8Array }> {
  if (!isZip(bytes)) return [{ name: fileName, bytes }];
  const out: Array<{ name: string; bytes: Uint8Array }> = [];
  try {
    const entries = unzipSync(bytes, {
      filter: (f) => !f.name.endsWith("/") && !f.name.startsWith("__MACOSX/") && !(f.name.split("/").pop() ?? "").startsWith("."),
    });
    for (const [name, data] of Object.entries(entries)) {
      const base = name.split("/").pop() ?? name;
      if (isZip(data)) out.push(...splitUpload(base, data));
      else out.push({ name: base, bytes: data });
    }
  } catch {
    return [{ name: fileName, bytes }];
  }
  return out;
}
