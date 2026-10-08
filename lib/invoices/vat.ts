// lib/invoices/vat.ts
// Expected Italian VAT rates for typical Ho.Re.Ca. purchases (DPR 633/72,
// Tabella A parte II e III). Deliberately conservative: a category lists every
// rate that can legitimately apply, and lines whose category is not recognised
// are never flagged. The result is a hint for the accountant, not a verdict —
// VAT is deductible for the restaurant, so the € impact is cash-flow only.

import { normalizeText } from "./text.ts";

export interface VatCategory {
  id: string;
  label: string;
  rates: number[];
  keywords: string[];
}

export const VAT_CATEGORIES: VatCategory[] = [
  {
    id: "bevande_alcoliche",
    label: "Vino, birra, alcolici",
    rates: [22],
    keywords: ["vino", "prosecco", "spumante", "birra", "grappa", "amaro", "liquore", "vodka", "gin", "rum", "whisky", "chianti", "barolo", "lambrusco", "franciacorta", "champagne"],
  },
  {
    id: "bevande_analcoliche",
    label: "Acqua e bibite",
    rates: [22],
    keywords: ["acqua minerale", "acqua naturale", "acqua frizzante", "bibita", "aranciata", "cola", "chinotto", "succo", "tonica", "energy"],
  },
  {
    id: "non_alimentari",
    label: "Detersivi, monouso, materiali",
    rates: [22],
    keywords: ["detersiv", "sgrassat", "igienizzant", "tovaglioli", "tovaglie", "piatti monouso", "bicchieri", "sacchi", "pellicol", "alluminio", "carta forno", "guanti", "candeggin", "brillantante"],
  },
  {
    id: "trasporto",
    label: "Trasporto / servizi",
    rates: [22],
    keywords: ["trasporto", "spedizione", "consegna", "contributo", "noleggio"],
  },
  {
    id: "caffe",
    label: "Caffè, tè",
    rates: [10, 22],
    keywords: ["caffe", "espresso", "capsule", "cialde", "te verde", "infuso"],
  },
  {
    id: "conserve_pomodoro",
    label: "Conserve di pomodoro",
    rates: [4, 10],
    keywords: ["passata", "pelati", "polpa di pomodoro", "concentrato di pomodoro"],
  },
  {
    id: "cioccolato",
    label: "Cioccolato e cacao",
    rates: [10, 22],
    keywords: ["cioccolat", "cacao"],
  },
  {
    id: "zucchero_miele_dolci",
    label: "Zucchero, miele, conserve",
    rates: [10],
    keywords: ["zucchero", "miele", "marmellat", "confettur", "aceto"],
  },
  {
    id: "carne_pesce_uova",
    label: "Carne, salumi, pesce",
    rates: [10],
    keywords: [
      "manzo", "vitello", "maiale", "suino", "pollo", "tacchino", "agnello", "salsicc", "guancial", "pancett",
      "prosciutt", "salame", "bresaola", "mortadell", "speck", "filetto", "costat", "tagliat", "macinat",
      "salmone", "tonno", "gamber", "calamar", "polpo", "cozze", "vongol", "orata", "branzin", "baccala", "merluzz", "pesce",
    ],
  },
  {
    id: "uova",
    label: "Uova",
    rates: [4, 10],
    keywords: ["uova", "uovo"],
  },
  {
    id: "olio",
    label: "Olio d'oliva",
    rates: [4],
    keywords: ["olio extravergine", "olio evo", "olio d oliva", "olio di oliva", "extravergine"],
  },
  {
    id: "latte_formaggi",
    label: "Latte, formaggi, burro",
    rates: [4],
    keywords: ["latte", "mozzarell", "formagg", "parmigian", "grana", "pecorin", "ricott", "burro", "burrat", "stracchin", "gorgonzol", "provol", "scamorz", "fior di latte", "mascarpon"],
  },
  {
    id: "pane_pasta_farine",
    label: "Pane, pasta, farine, riso",
    rates: [4],
    keywords: ["pane", "farina", "semola", "pasta", "spaghett", "penne", "rigaton", "fusill", "tagliatell", "lasagn", "riso", "carnaroli", "arborio", "grissini", "fett biscott"],
  },
  {
    id: "frutta_verdura",
    label: "Frutta e verdura fresca",
    rates: [4],
    keywords: [
      "insalata", "lattuga", "rucola", "pomodor", "patat", "zucchin", "melanzan", "peperon", "carot", "cipoll",
      "aglio", "basilico", "prezzemolo", "limon", "arance", "arancia", "mela", "mele", "pere", "banan", "fragol",
      "spinaci", "carciof", "funghi", "radicchio", "finocchi", "sedano", "verdur", "frutta", "agrumi",
    ],
  },
];

/** Detect the category of a line (first keyword match wins; null = unknown). */
export function detectVatCategory(description: string): VatCategory | null {
  const text = ` ${normalizeText(description)} `;
  // Categories are ordered: drinks and non-food first ("succo di pomodoro").
  for (const cat of VAT_CATEGORIES) {
    for (const kw of cat.keywords) {
      if (text.includes(` ${kw}`)) return cat;
    }
  }
  return null;
}

export interface VatCheck {
  category: VatCategory;
  expected: number[];
  billed: number;
}

/**
 * Returns a VatCheck when the billed rate is not admissible for the detected
 * category; null when consistent or not decidable. Zero-rated lines with a
 * Natura code (esenti, reverse charge…) are not judged.
 */
export function checkVatRate(description: string, billedRate: number, natura: string | null): VatCheck | null {
  if (natura) return null;
  const cat = detectVatCategory(description);
  if (!cat) return null;
  if (cat.rates.some((r) => Math.abs(r - billedRate) < 0.01)) return null;
  return { category: cat, expected: cat.rates, billed: billedRate };
}
