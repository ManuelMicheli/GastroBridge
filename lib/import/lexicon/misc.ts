// Brands, availability phrases, origins, noise phrases.

import { fold } from "../text.ts";

/** Common Ho.Re.Ca. brands (display form). Matched as whole words. */
export const BRANDS = [
  "Barilla", "De Cecco", "Rummo", "Garofalo", "Divella", "Voiello", "La Molisana", "Granoro", "Del Verde", "Felicetti",
  "Mutti", "Cirio", "Knorr", "Calvè", "Heinz", "Hellmann's", "Kikkoman",
  "Galbani", "Granarolo", "Parmalat", "Zanetti", "Santa Lucia", "Vallelata", "Brimi", "Sterilgarda", "Prealpi", "Bayernland",
  "Monini", "Carapelli", "Bertolli", "Sasso", "Farchioni", "De Nigris", "Ponti", "Varvello",
  "Caputo", "Molino Caputo", "Spadoni", "Molino Spadoni", "5 Stagioni", "Le 5 Stagioni", "Polselli", "Petra", "Grandi Molini",
  "Levoni", "Rovagnati", "Beretta", "Citterio", "Negroni", "Fiorucci", "Parmacotto", "Ferrarini", "Villani", "Galloni",
  "Lavazza", "Illy", "Kimbo", "Segafredo", "Vergnano", "Pellini", "Borbone", "Caffè Borbone",
  "San Pellegrino", "S.Pellegrino", "Levissima", "Acqua Panna", "Ferrarelle", "Sant'Anna", "Lete", "Uliveto",
  "San Benedetto", "Lurisia", "Coca-Cola", "Coca Cola", "Fanta", "Sprite", "Schweppes", "Red Bull", "Estathè",
  "Peroni", "Nastro Azzurro", "Moretti", "Birra Moretti", "Menabrea", "Ichnusa", "Heineken", "Corona", "Tennent's", "Ceres",
  "Aperol", "Campari", "Martini", "Cinzano", "Disaronno", "Montenegro", "Averna", "Jägermeister",
  "Algida", "Sammontana", "Bonduelle", "Orogel", "Findus", "Pinguino", "Surgital", "Bauli", "Lazzaroni", "Balocco", "Mulino Bianco",
  "Ferrero", "Nutella", "Callipo", "Rio Mare", "Asdomar", "Nostromo", "Mareblu",
  "Fabbri", "Cameo", "Pane degli Angeli", "Paneangeli", "Elah", "Dufour",
  "Amadori", "Aia", "Fileni", "Inalca",
] as const;

const BRAND_INDEX: Array<{ folded: string; display: string }> = [...BRANDS]
  .map((b) => ({ folded: fold(b), display: b }))
  .sort((a, b) => b.folded.length - a.folded.length);

export function findBrand(text: string): { brand: string; start: number; end: number } | null {
  const f = fold(text);
  for (const { folded, display } of BRAND_INDEX) {
    const re = new RegExp(String.raw`(^|[^a-z0-9])(${folded.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?=$|[^a-z0-9])`);
    const m = re.exec(f);
    if (m) {
      const start = m.index + m[1]!.length;
      return { brand: display, start, end: start + m[2]!.length };
    }
  }
  const labeled = /\b(?:marca|marchio|brand)\s*[:]?\s*([A-ZÀ-Ú][\wÀ-ú'&.-]*(?:\s+[A-ZÀ-Ú][\wÀ-ú'&.-]*){0,2})/.exec(text);
  if (labeled) return { brand: labeled[1]!, start: labeled.index, end: labeled.index + labeled[0].length };
  return null;
}

const MONTHS = "gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|genn?\\.?|febb?\\.?|mar\\.|apr\\.?|magg?\\.?|giu\\.?|lug\\.?|ago\\.?|sett?\\.?|ott\\.?|nov\\.?|dic\\.?";

const AVAILABILITY_RE = new RegExp(
  String.raw`\(?\s*(?:` +
    [
      String.raw`(?:non\s+)?disponibil[ei](?:\s+(?:da|fino\s+a|a\s+partire\s+da|dal|dalla|solo|su\s+richiesta|su\s+ordinazione)[^,;()]*)?`,
      String.raw`fino\s+ad?\s+esaurimento(?:\s+scorte)?`,
      String.raw`esaurit[oaie]`,
      String.raw`terminat[oaie]`,
      String.raw`momentaneamente\s+(?:non\s+disponibile|esaurit[oa]|assente)`,
      String.raw`su\s+(?:ordinazione|richiesta|prenotazione)`,
      String.raw`(?:solo\s+)?(?:in\s+)?stagion(?:e|al[ei])(?:\s+[^,;()]*)?`,
      String.raw`(?:da|dal|dalla|fino\s+a|a\s+partire\s+da)\s+(?:${MONTHS})(?:\s+(?:a|al|fino\s+a)\s+(?:${MONTHS}))?`,
      String.raw`(?:arrivo|in\s+arrivo|prossimo\s+arrivo)(?:\s+[^,;()]*)?`,
      String.raw`novit[aà]`,
      String.raw`(?:in\s+)?(?:promo(?:zione)?|offerta)(?:\s+[^,;()]*)?`,
      String.raw`preordine`,
      String.raw`ultim[ie]\s+pezzi`,
    ].join("|") +
    String.raw`)\s*\)?`,
  "i",
);

export function findAvailability(text: string): { note: string; available: boolean; start: number; end: number } | null {
  const m = AVAILABILITY_RE.exec(text);
  if (!m) return null;
  const note = m[0].replace(/^[\s(]+|[\s)]+$/g, "").trim();
  if (!note) return null;
  const available = !/\b(non\s+disponibil|esaurit|terminat|momentaneamente)/i.test(note);
  return { note, available, start: m.index, end: m.index + m[0].length };
}

const ORIGIN_RE =
  /\b(?:origine|provenienza|prov\.|orig\.)\s*[:]?\s*([A-ZÀ-Úa-zà-ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)|\((italia|spagna|francia|germania|olanda|grecia|marocco|egitto|israele|sudafrica|cile|argentina|peru|perù|costa rica|ecuador|colombia|brasile|usa|nuova zelanda|norvegia|scozia|irlanda|danimarca|polonia|ue|extra ue)\)/i;

export function findOrigin(text: string): { origin: string; start: number; end: number } | null {
  const m = ORIGIN_RE.exec(text);
  if (!m) return null;
  const o = (m[1] ?? m[2] ?? "").trim();
  if (!o) return null;
  return { origin: o.charAt(0).toUpperCase() + o.slice(1), start: m.index, end: m.index + m[0].length };
}

/** Phrases that mark a line as noise (greetings, page furniture, totals). */
export const NOISE_PATTERNS: RegExp[] = [
  /^(buon(?:giorno|asera|pomeriggio)|salve|ciao|gentil[ei]|egregi[oa]|spett(?:\.le|abile)|caro|cara|alla\s+c\.a\.|c\.a\.)\b/i,
  /^(cordiali|distinti|cari|un)?\s*salut[io]\b/i,
  /^(grazie|a presto|a disposizione|resto a disposizione|restiamo a disposizione|in attesa|vi (?:invio|inviamo|mando|giro|allego)|ti (?:mando|invio|giro|allego)|ecco (?:il|i|la|le)|come (?:da|d'accordo)|di seguito|in allegato|allego|vi ricordo|vi ricordiamo)\b/i,
  /^(pag(?:\.|ina)?\s*\d+(?:\s*(?:di|\/)\s*\d+)?|\d+\s*\/\s*\d+)$/i,
  /^(totale|subtotale|imponibile|tot\.|sconto|trasporto|spese di)\b/i,
  /^(listino(?:\s+prezzi)?|prezzi|offerte?|catalogo|aggiornamento|validit[aà]|valido|valid[oi]\s+(?:dal|fino|da))\b/i,
  /^(inviato da|sent from|questa e-?mail|this e-?mail|il presente messaggio|informativa|privacy|ai sensi|d\.lgs|gdpr|riservat)/i,
  /^<(?:media|immagine|allegato)[^>]*>$/i,
  /^(messaggio eliminato|questo messaggio è stato eliminato|immagine omessa|image omitted|<media omessi>|media omessi)$/i,
  /^-{2,}\s*(?:messaggio originale|original message|forwarded message|messaggio inoltrato)/i,
  /^(il|on)\s.+\s(ha scritto|wrote):?$/i,
];

export function isNoiseText(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (!/[a-z0-9]/i.test(t)) return true;
  return NOISE_PATTERNS.some((re) => re.test(t));
}
