// lib/invoices/p7m.ts
// Extract the signed content (the FatturaPA XML) from a CAdES / PKCS#7
// ".p7m" envelope.
//
// A minimal BER/DER reader instead of a full crypto library: we only need the
// `encapContentInfo.eContent` OCTET STRING of a CMS SignedData. Handles:
//   * DER and BER (indefinite lengths, as produced by `openssl cms -stream`
//     and by several Italian signing tools);
//   * constructed OCTET STRINGs (content split in chunks);
//   * nested envelopes (a .p7m signed twice → .p7m.p7m);
//   * base64 / PEM wrapped files (handled by the caller via decode.ts).
//
// The signature is NOT verified: the SDI already validated it before
// delivering the invoice, and the restaurant only needs the data. Verification
// (and legal storage, "conservazione") stays with the SDI intermediary / the
// accountant.

interface Tlv {
  tagClass: number; // 0 universal, 1 application, 2 context, 3 private
  constructed: boolean;
  tagNumber: number;
  /** Offset of the first content byte. */
  start: number;
  /** Offset after the last content byte (excludes the EOC of indefinite forms). */
  contentEnd: number;
  /** Offset after the whole element (including EOC). */
  end: number;
  indefinite: boolean;
}

export class P7mError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "P7mError";
  }
}

function readTlv(buf: Uint8Array, offset: number, limit: number, depth = 0): Tlv {
  if (depth > 64) throw new P7mError("Struttura ASN.1 troppo profonda");
  if (offset >= limit) throw new P7mError("Fine inattesa dei dati ASN.1");
  let p = offset;
  const first = buf[p++]!;
  const tagClass = first >> 6;
  const constructed = (first & 0x20) !== 0;
  let tagNumber = first & 0x1f;
  if (tagNumber === 0x1f) {
    tagNumber = 0;
    let b: number;
    do {
      if (p >= limit) throw new P7mError("Tag ASN.1 troncato");
      b = buf[p++]!;
      tagNumber = (tagNumber << 7) | (b & 0x7f);
    } while (b & 0x80);
  }
  if (p >= limit) throw new P7mError("Lunghezza ASN.1 mancante");
  const lenByte = buf[p++]!;
  if (lenByte === 0x80) {
    if (!constructed) throw new P7mError("Lunghezza indefinita su elemento primitivo");
    // Walk children until the end-of-contents marker (00 00).
    const start = p;
    let q = p;
    for (;;) {
      if (q + 1 >= limit) throw new P7mError("Marcatore di fine contenuto mancante");
      if (buf[q] === 0 && buf[q + 1] === 0) {
        return { tagClass, constructed, tagNumber, start, contentEnd: q, end: q + 2, indefinite: true };
      }
      q = readTlv(buf, q, limit, depth + 1).end;
    }
  }
  let length = 0;
  if (lenByte & 0x80) {
    const n = lenByte & 0x7f;
    if (n > 4) throw new P7mError("Lunghezza ASN.1 non supportata");
    for (let k = 0; k < n; k++) {
      if (p >= limit) throw new P7mError("Lunghezza ASN.1 troncata");
      length = length * 256 + buf[p++]!;
    }
  } else {
    length = lenByte;
  }
  const end = p + length;
  if (end > limit) throw new P7mError("Elemento ASN.1 oltre la fine del file");
  return { tagClass, constructed, tagNumber, start: p, contentEnd: end, end, indefinite: false };
}

function childrenOf(buf: Uint8Array, tlv: Tlv): Tlv[] {
  const out: Tlv[] = [];
  let p = tlv.start;
  while (p < tlv.contentEnd) {
    const c = readTlv(buf, p, tlv.contentEnd);
    out.push(c);
    p = c.end;
  }
  return out;
}

/** Collect the bytes of a (possibly constructed) OCTET STRING. */
function octetStringBytes(buf: Uint8Array, tlv: Tlv): Uint8Array {
  if (!tlv.constructed) return buf.subarray(tlv.start, tlv.contentEnd);
  const parts: Uint8Array[] = [];
  for (const c of childrenOf(buf, tlv)) parts.push(octetStringBytes(buf, c));
  const total = parts.reduce((s, x) => s + x.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const x of parts) {
    out.set(x, o);
    o += x.length;
  }
  return out;
}

const OID_SIGNED_DATA = "1.2.840.113549.1.7.2";

function decodeOid(buf: Uint8Array, tlv: Tlv): string {
  const bytes = buf.subarray(tlv.start, tlv.contentEnd);
  if (bytes.length === 0) return "";
  const parts: number[] = [];
  const first = bytes[0]!;
  parts.push(Math.floor(first / 40), first % 40);
  let v = 0;
  for (let i = 1; i < bytes.length; i++) {
    v = v * 128 + (bytes[i]! & 0x7f);
    if (!(bytes[i]! & 0x80)) {
      parts.push(v);
      v = 0;
    }
  }
  return parts.join(".");
}

function isUniversal(t: Tlv, n: number): boolean {
  return t.tagClass === 0 && t.tagNumber === n;
}

function isContext(t: Tlv, n: number): boolean {
  return t.tagClass === 2 && t.tagNumber === n;
}

/** True when bytes start like a DER/BER SEQUENCE (PKCS#7 envelope). */
export function looksLikeP7m(bytes: Uint8Array): boolean {
  return bytes.length > 16 && bytes[0] === 0x30 && (bytes[1] === 0x80 || (bytes[1]! & 0x80) !== 0);
}

function extractOnce(buf: Uint8Array): Uint8Array {
  const root = readTlv(buf, 0, buf.length);
  if (!isUniversal(root, 16)) throw new P7mError("Il file non è una busta PKCS#7");
  const [oid, explicit] = childrenOf(buf, root);
  if (!oid || !isUniversal(oid, 6) || decodeOid(buf, oid) !== OID_SIGNED_DATA) {
    throw new P7mError("La busta non contiene dati firmati (SignedData)");
  }
  if (!explicit || !isContext(explicit, 0)) throw new P7mError("Contenuto SignedData mancante");
  const [signedData] = childrenOf(buf, explicit);
  if (!signedData || !isUniversal(signedData, 16)) throw new P7mError("SignedData malformato");
  const sdChildren = childrenOf(buf, signedData);
  // version INTEGER, digestAlgorithms SET, encapContentInfo SEQUENCE, …
  const encap = sdChildren.find((c, i) => i >= 1 && isUniversal(c, 16));
  if (!encap) throw new P7mError("encapContentInfo mancante");
  const encapChildren = childrenOf(buf, encap);
  const eContentWrapper = encapChildren.find((c) => isContext(c, 0));
  if (!eContentWrapper) {
    throw new P7mError("Firma staccata (detached): il file .p7m non contiene la fattura");
  }
  const [octets] = childrenOf(buf, eContentWrapper);
  if (!octets || !isUniversal(octets, 4)) throw new P7mError("eContent non è un OCTET STRING");
  return octetStringBytes(buf, octets);
}

/** Heuristic fallback: locate the XML inside a DER blob that was not chunked. */
function scanForXml(buf: Uint8Array): Uint8Array | null {
  const text = new TextDecoder("latin1").decode(buf);
  const start = (() => {
    const decl = text.indexOf("<?xml");
    if (decl !== -1) return decl;
    const m = /<([A-Za-z0-9_]+:)?FatturaElettronica[\s>]/.exec(text);
    return m ? m.index : -1;
  })();
  if (start === -1) return null;
  const closeRe = /<\/([A-Za-z0-9_]+:)?FatturaElettronica(Semplificata)?\s*>/g;
  let last: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  closeRe.lastIndex = start;
  while ((m = closeRe.exec(text))) last = m;
  if (!last) return null;
  return buf.subarray(start, last.index + last[0].length);
}

/**
 * Return the signed payload of a .p7m file. Unwraps nested envelopes
 * (up to 3 levels). Throws P7mError when the envelope is unreadable.
 */
export function extractP7mContent(bytes: Uint8Array): Uint8Array {
  let current = bytes;
  for (let level = 0; level < 3; level++) {
    let inner: Uint8Array;
    try {
      inner = extractOnce(current);
    } catch (err) {
      if (level > 0) return current;
      const scanned = scanForXml(current);
      if (scanned) return scanned;
      throw err instanceof P7mError ? err : new P7mError("Busta .p7m illeggibile");
    }
    if (!looksLikeP7m(inner)) return inner;
    current = inner;
  }
  return current;
}
