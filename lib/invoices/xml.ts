// lib/invoices/xml.ts
// Minimal, dependency-free XML reader for FatturaPA documents.
//
// Why not a library: FatturaPA is plain data XML (no DTD, no mixed content)
// and we only need a read-only element tree. A small hand-written reader keeps
// the parser deterministic, works in Node and in the browser, and never
// expands external entities (no XXE): DOCTYPE declarations are skipped.
//
// Namespaces: element names keep only their local part ("p:FatturaElettronica"
// → "FatturaElettronica"), which is what every FatturaPA producer agrees on
// (prefixes vary: p:, ns2:, ns3:, a:, none…).

export interface XmlElement {
  /** Local name (namespace prefix stripped). */
  name: string;
  /** Qualified name as written in the document. */
  qname: string;
  /**
   * Lookup key: local name lowercased without "_" so that XML element names
   * ("IdFiscaleIVA") and the snake_case JSON rendering some SDI intermediaries
   * use ("id_fiscale_iva") resolve to the same key.
   */
  key: string;
  attrs: Record<string, string>;
  children: XmlElement[];
  /** Concatenated character data directly inside this element. */
  text: string;
}

export class XmlParseError extends Error {
  constructor(message: string, readonly position: number) {
    super(`${message} (pos ${position})`);
    this.name = "XmlParseError";
  }
}

const NAMED_ENTITIES: Record<string, string> = {
  lt: "<",
  gt: ">",
  amp: "&",
  quot: '"',
  apos: "'",
};

export function decodeEntities(raw: string): string {
  if (raw.indexOf("&") === -1) return raw;
  return raw.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return m;
      try {
        return String.fromCodePoint(code);
      } catch {
        return m;
      }
    }
    return NAMED_ENTITIES[body] ?? m;
  });
}

function localName(qname: string): string {
  const i = qname.indexOf(":");
  return i === -1 ? qname : qname.slice(i + 1);
}

export function nameKey(name: string): string {
  return name.replace(/_/g, "").toLowerCase();
}

export function makeElement(qname: string, attrs: Record<string, string> = {}, text = ""): XmlElement {
  const name = localName(qname);
  return { name, qname, key: nameKey(name), attrs, children: [], text };
}

const NAME_END = /[\s/>]/;

/**
 * Parse an XML document and return its root element.
 * Throws XmlParseError on malformed input.
 */
export function parseXml(input: string): XmlElement {
  const s = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const len = s.length;
  let i = 0;
  const stack: XmlElement[] = [];
  let root: XmlElement | null = null;
  // Text chunks of the current element (joined on close: avoids O(n²) concat).
  const textStack: string[][] = [];

  const appendText = (t: string) => {
    if (stack.length === 0) {
      if (t.trim().length > 0) throw new XmlParseError("Testo fuori dall'elemento radice", i);
      return;
    }
    textStack[textStack.length - 1]!.push(t);
  };

  while (i < len) {
    const lt = s.indexOf("<", i);
    if (lt === -1) {
      appendText(decodeEntities(s.slice(i)));
      break;
    }
    if (lt > i) appendText(decodeEntities(s.slice(i, lt)));
    i = lt;

    if (s.startsWith("<!--", i)) {
      const end = s.indexOf("-->", i + 4);
      if (end === -1) throw new XmlParseError("Commento non chiuso", i);
      i = end + 3;
      continue;
    }
    if (s.startsWith("<![CDATA[", i)) {
      const end = s.indexOf("]]>", i + 9);
      if (end === -1) throw new XmlParseError("CDATA non chiuso", i);
      appendText(s.slice(i + 9, end));
      i = end + 3;
      continue;
    }
    if (s.startsWith("<?", i)) {
      const end = s.indexOf("?>", i + 2);
      if (end === -1) throw new XmlParseError("Istruzione di elaborazione non chiusa", i);
      i = end + 2;
      continue;
    }
    if (s.startsWith("<!", i)) {
      // DOCTYPE (possibly with an internal subset): skipped, never expanded.
      let depth = 0;
      let j = i + 2;
      for (; j < len; j++) {
        const c = s[j];
        if (c === "[") depth++;
        else if (c === "]") depth--;
        else if (c === ">" && depth <= 0) break;
      }
      if (j >= len) throw new XmlParseError("Dichiarazione non chiusa", i);
      i = j + 1;
      continue;
    }
    if (s[i + 1] === "/") {
      const end = s.indexOf(">", i + 2);
      if (end === -1) throw new XmlParseError("Tag di chiusura non terminato", i);
      const qname = s.slice(i + 2, end).trim();
      const open = stack.pop();
      const chunks = textStack.pop();
      if (!open || open.qname !== qname) {
        throw new XmlParseError(`Tag di chiusura inatteso </${qname}>`, i);
      }
      open.text = chunks ? chunks.join("") : "";
      if (stack.length === 0) root = open;
      i = end + 1;
      continue;
    }

    // Start tag.
    let j = i + 1;
    while (j < len && !NAME_END.test(s[j]!)) j++;
    const qname = s.slice(i + 1, j);
    if (!qname) throw new XmlParseError("Nome elemento mancante", i);
    const attrs: Record<string, string> = {};
    let selfClosing = false;
    for (;;) {
      while (j < len && /\s/.test(s[j]!)) j++;
      if (j >= len) throw new XmlParseError(`Tag <${qname}> non terminato`, i);
      const c = s[j];
      if (c === ">") {
        j++;
        break;
      }
      if (c === "/" && s[j + 1] === ">") {
        selfClosing = true;
        j += 2;
        break;
      }
      const eq = s.indexOf("=", j);
      if (eq === -1) throw new XmlParseError("Attributo malformato", j);
      const attrName = s.slice(j, eq).trim();
      let k = eq + 1;
      while (k < len && /\s/.test(s[k]!)) k++;
      const quote = s[k];
      if (quote !== '"' && quote !== "'") throw new XmlParseError("Valore attributo senza virgolette", k);
      const close = s.indexOf(quote, k + 1);
      if (close === -1) throw new XmlParseError("Valore attributo non chiuso", k);
      attrs[attrName] = decodeEntities(s.slice(k + 1, close));
      j = close + 1;
    }
    const el = makeElement(qname, attrs);
    if (stack.length > 0) stack[stack.length - 1]!.children.push(el);
    else if (root) throw new XmlParseError("Più di un elemento radice", i);
    if (selfClosing) {
      if (stack.length === 0) root = el;
    } else {
      stack.push(el);
      textStack.push([]);
    }
    i = j;
  }

  if (stack.length > 0) throw new XmlParseError(`Elemento <${stack[stack.length - 1]!.qname}> non chiuso`, len);
  if (!root) throw new XmlParseError("Documento vuoto", 0);
  return root;
}

/* ------------------------------------------------------------------ */
/* Navigation helpers                                                   */
/* ------------------------------------------------------------------ */

/** First direct child with the given local name. */
export function child(el: XmlElement | null | undefined, name: string): XmlElement | null {
  if (!el) return null;
  const k = nameKey(name);
  for (const c of el.children) if (c.key === k) return c;
  return null;
}

/** All direct children with the given local name. */
export function children(el: XmlElement | null | undefined, name: string): XmlElement[] {
  if (!el) return [];
  const k = nameKey(name);
  return el.children.filter((c) => c.key === k);
}

/** Follow a path of local names through first matching children. */
export function path(el: XmlElement | null | undefined, ...names: string[]): XmlElement | null {
  let cur: XmlElement | null = el ?? null;
  for (const n of names) {
    cur = child(cur, n);
    if (!cur) return null;
  }
  return cur;
}

/** Trimmed text of a descendant path, or null when missing/empty. */
export function textAt(el: XmlElement | null | undefined, ...names: string[]): string | null {
  const node = names.length === 0 ? (el ?? null) : path(el, ...names);
  if (!node) return null;
  const t = node.text.replace(/\s+/g, " ").trim();
  return t.length > 0 ? t : null;
}

/** Depth-first search for the first element with the given local name. */
export function findFirst(el: XmlElement, name: string): XmlElement | null {
  const k = nameKey(name);
  const walk = (node: XmlElement): XmlElement | null => {
    if (node.key === k) return node;
    for (const c of node.children) {
      const hit = walk(c);
      if (hit) return hit;
    }
    return null;
  };
  return walk(el);
}

/**
 * Build an element tree from a JSON rendering of a FatturaPA document
 * (objects → elements, arrays → repeated elements, scalars → text). Used for
 * intermediaries that deliver the invoice as JSON instead of XML.
 */
export function jsonToElement(rootName: string, value: unknown): XmlElement {
  const el = makeElement(rootName);
  if (value === null || value === undefined) return el;
  if (typeof value !== "object") {
    el.text = String(value);
    return el;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(v)) {
      for (const item of v) el.children.push(jsonToElement(k, item));
    } else {
      el.children.push(jsonToElement(k, v));
    }
  }
  return el;
}
