// Text helpers: folding, cleaning pasted chats / emails, tokenizing.

/** Lowercase, strip diacritics, collapse whitespace. */
export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Folded key for matching names: letters/digits only, single spaces. */
export function nameKey(s: string): string {
  return fold(s)
    .replace(/[^a-z0-9%]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Emoji & pictographs (keeps letters with accents, €, %, digits).
const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu;

export function stripEmoji(s: string): string {
  return s.replace(EMOJI_RE, " ");
}

/** Unify unicode spaces, dashes, multiplication signs and euro spellings. */
export function normalizeChars(s: string): string {
  return s
    .replace(/[       ]/g, " ")
    .replace(/[‐-―−]/g, "-")
    .replace(/[×✕✖]/g, "x")
    .replace(/[‘’´`]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/\t/g, "   ")
    .replace(/\r/g, "");
}

// WhatsApp exports and copy/paste:
//   "[12/03/24, 09:14:22] Mario Rossi: testo"
//   "12/03/24, 09:14 - Mario Rossi: testo"
//   "[09:14, 12/3/2024] Mario: testo"  (desktop copy)
const WA_BRACKET = /^\s*\[(?:\d{1,2}[/.]\d{1,2}(?:[/.]\d{2,4})?,?\s*)?\d{1,2}[:.]\d{2}(?:[:.]\d{2})?(?:,?\s*\d{1,2}[/.]\d{1,2}(?:[/.]\d{2,4})?)?\]\s*([^:]{1,40}):\s?/;
const WA_DASH = /^\s*\d{1,2}[/.]\d{1,2}[/.]\d{2,4},?\s+\d{1,2}[:.]\d{2}(?:\s?[AP]M)?\s+-\s+([^:]{1,40}):\s?/i;

export type ChatStrip = { text: string; sender: string | null };

/** Remove a WhatsApp/Telegram timestamp + sender prefix from a line. */
export function stripChatPrefix(line: string): ChatStrip {
  const m = WA_BRACKET.exec(line) ?? WA_DASH.exec(line);
  if (!m) return { text: line, sender: null };
  return { text: line.slice(m[0].length), sender: m[1]!.trim() };
}

const EMAIL_HEADER_RE = /^\s*(da|from|a|to|cc|ccn|bcc|oggetto|subject|inviato|sent|data|date|reply-to|rispondi a)\s*:\s*(.*)$/i;

export type EmailHeader = { key: string; value: string };

export function parseEmailHeader(line: string): EmailHeader | null {
  const m = EMAIL_HEADER_RE.exec(line);
  if (!m) return null;
  return { key: fold(m[1]!), value: m[2]!.trim() };
}

/** Leading bullets / list markers: "- ", "• ", "* ", "1) ", "1. ", "a) ", "✅ ". */
const BULLET_RE = /^\s*(?:[-–—•·▪▫◦●○■□►▶➤→*+>]+|\(?\d{1,3}[).]|[a-z]\))\s+/i;

export function stripBullet(s: string): string {
  let out = s;
  // A numbered marker "12) " or "3. " is only stripped when followed by text.
  for (let i = 0; i < 2; i++) {
    const m = BULLET_RE.exec(out);
    if (!m) break;
    const rest = out.slice(m[0].length);
    if (!/[a-zà-ú]/i.test(rest)) break;
    out = rest;
  }
  return out;
}

/** Quoted reply markers in emails: "> testo". */
export function stripQuote(s: string): string {
  return s.replace(/^\s*(?:>\s?)+/, "");
}

/** Clean a raw text line coming from paste / OCR / PDF. */
export function cleanLine(line: string): string {
  return stripBullet(stripQuote(stripEmoji(normalizeChars(line))))
    .replace(/\s{2,}/g, (m) => (m.length >= 3 ? "   " : " "))
    .replace(/^[\s|;:,]+|[\s|;,]+$/g, "")
    .trim();
}

/** Capitalize the first letter, keep the rest (acronyms stay uppercase). */
export function sentenceCase(s: string): string {
  const t = s.trim();
  if (!t) return t;
  // ALL CAPS input → lowercase first, preserving known acronyms.
  const letters = t.replace(/[^a-zA-ZÀ-ú]/g, "");
  const upper = letters.replace(/[^A-ZÀ-Þ]/g, "").length;
  let base = t;
  if (letters.length >= 4 && upper / letters.length > 0.7) {
    base = t
      .split(/(\s+)/)
      .map((w) => (KEEP_UPPER.has(w.replace(/[^A-Z0-9]/gi, "").toUpperCase()) ? w.toUpperCase() : w.toLowerCase()))
      .join("");
  }
  return base.charAt(0).toUpperCase() + base.slice(1);
}

const KEEP_UPPER = new Set([
  "DOP", "IGP", "IGT", "DOC", "DOCG", "STG", "BIO", "UHT", "EVO", "IQF", "XL", "XXL", "L", "M", "S",
  "AOP", "PAT", "GDO", "PET", "UE", "USA", "IT", "BBQ", "MSC", "ASC",
]);

/** Split on runs of 3+ spaces (column gaps in PDF/OCR text) — keeps single spaces. */
export function splitColumns(line: string): string[] {
  return line.split(/\s{3,}|\s*\|\s*|\t+/).map((s) => s.trim()).filter(Boolean);
}
