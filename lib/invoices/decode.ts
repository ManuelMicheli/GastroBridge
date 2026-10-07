// lib/invoices/decode.ts
// Byte-level helpers shared by the ingestion pipeline (browser + Node safe).

/** Decode XML bytes honouring BOM and the `encoding` declaration. */
export function decodeXmlBytes(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  }
  // UTF-16 without BOM: "<\0?\0" pattern.
  if (bytes.length >= 4 && bytes[0] === 0x3c && bytes[1] === 0x00 && bytes[2] === 0x3f && bytes[3] === 0x00) {
    return new TextDecoder("utf-16le").decode(bytes);
  }
  if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x3c && bytes[2] === 0x00 && bytes[3] === 0x3f) {
    return new TextDecoder("utf-16be").decode(bytes);
  }

  const head = latin1(bytes.subarray(0, Math.min(bytes.length, 256)));
  const m = /<\?xml[^>]*encoding\s*=\s*["']([A-Za-z0-9._-]+)["']/i.exec(head);
  const declared = m?.[1]?.toLowerCase();
  if (declared && declared !== "utf-8" && declared !== "utf8") {
    const label = declared === "iso-8859-1" || declared === "latin1" || declared === "latin-1" ? "windows-1252" : declared;
    try {
      return new TextDecoder(label).decode(bytes);
    } catch {
      /* unknown label: fall through to UTF-8 */
    }
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // Declared (or assumed) UTF-8 but it is not: the usual culprit is a
    // Windows-1252 export from an old invoicing program.
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export function latin1(bytes: Uint8Array): string {
  let out = "";
  const step = 8192;
  for (let i = 0; i < bytes.length; i += step) {
    out += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + step)));
  }
  return out;
}

const B64_RE = /^[A-Za-z0-9+/=\s]+$/;

/** True when the bytes look like base64 text (used for base64 .p7m files). */
export function looksLikeBase64(bytes: Uint8Array): boolean {
  if (bytes.length < 16) return false;
  const sample = latin1(bytes.subarray(0, Math.min(bytes.length, 4096)));
  return B64_RE.test(sample.replace(/-----(BEGIN|END)[^-]+-----/g, ""));
}

export function base64ToBytes(text: string): Uint8Array {
  const clean = text.replace(/-----(BEGIN|END)[^-]+-----/g, "").replace(/[^A-Za-z0-9+/=]/g, "");
  if (typeof atob === "function") {
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  /* c8 ignore next */
  throw new Error("base64 decoder non disponibile");
}

export function bytesToBase64(bytes: Uint8Array): string {
  return btoa(latin1(bytes));
}

/** Hex SHA-256 of bytes (WebCrypto — available in Node ≥ 18 and browsers). */
export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
