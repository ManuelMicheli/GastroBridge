// Keyword inference for product categories when we only have a free-form
// product name (e.g. catalog orders where order_items are not populated).
// The categories match the MacroCategory enum used in products.macro_category.

export type MacroCategory =
  | "carne"
  | "pesce"
  | "verdura"
  | "frutta"
  | "latticini"
  | "secco"
  | "bevande"
  | "surgelati"
  | "panetteria"
  | "altro";

type CategoryRule = {
  category: MacroCategory;
  keywords: string[];
};

// Order matters: first match wins. Put surgelati first because it overrides
// other meat/fish categories when the product is explicitly frozen.
const RULES: CategoryRule[] = [
  {
    category: "surgelati",
    keywords: ["surgelat", "congelat", "frozen"],
  },
  {
    category: "carne",
    keywords: [
      "pollo", "manzo", "vitello", "maiale", "agnello", "tacchino", "bue",
      "prosciutto", "salame", "salsiccia", "bresaola", "speck", "pancetta",
      "guanciale", "mortadella", "wurstel", "hamburger", "spalla", "coscia",
      "petto", "filetto di pollo", "filetto di manzo", "costata",
      "carne", "macinat", "bistecca",
    ],
  },
  {
    category: "pesce",
    keywords: [
      "salmone", "merluzzo", "tonno", "branzino", "orata", "spigola", "sgombro",
      "sardina", "acciug", "alice", "gamber", "scampi", "calamar", "seppi",
      "polp", "vongol", "cozz", "ostrich", "granchio", "aragost",
      "pesce", "filetto di salmone", "trancio",
    ],
  },
  {
    category: "latticini",
    keywords: [
      "mozzarella", "parmigiano", "grana", "burro", "panna", "latte",
      "yogurt", "ricotta", "mascarpone", "pecorino", "gorgonzola", "stracchino",
      "taleggio", "fontina", "asiago", "emmental", "cheddar", "provola",
      "formaggio", "caciocavall", "scamorz", "cacioricotta", "robiola",
      "crema di latte", "crema al formaggio",
    ],
  },
  {
    category: "verdura",
    keywords: [
      "patat", "cipoll", "carota", "zucchin", "melanzan", "peperon", "pomodor",
      "insalat", "rucola", "spinaci", "broccol", "cavol", "finocchi", "sedano",
      "radicchio", "asparag", "aglio", "porro", "lattuga", "zucca",
      "verdura", "verdure", "funghi", "fagiolin", "piselli", "ceci", "lenticchie",
    ],
  },
  {
    category: "frutta",
    keywords: [
      "limon", "arance", "mandarin", "mele", "mela", "pere", "pera", "banan",
      "fragole", "lamponi", "mirtilli", "uva", "anguria", "melone", "pesche",
      "albicocc", "kiwi", "ananas", "ciliegie",
      "frutta",
    ],
  },
  {
    category: "bevande",
    keywords: [
      "vino", "birra", "acqua", "caffe", "caffè", "the", "tè", "succo",
      "bibita", "cola", "aranciata", "limonata", "spritz", "aperitivo",
      "liquore", "grappa", "amaro", "champagne", "prosecco", "spumante",
      "bevanda",
    ],
  },
  {
    category: "panetteria",
    keywords: [
      "pane", "baguette", "focaccia", "piadina", "pizza", "brioche", "cornett",
      "grissini", "crackers", "biscott", "torta",
    ],
  },
  {
    category: "secco",
    keywords: [
      "farina", "pasta", "spaghetti", "penne", "rigatoni", "linguine",
      "tagliatelle", "gnocchi", "riso", "orzo", "couscous", "quinoa",
      "zucchero", "sale", "pepe", "olio", "aceto", "lievito", "cioccolat",
      "cacao", "vaniglia", "cannella", "legumi", "conserva", "passata",
      "concentrato", "pelati", "scatolame",
    ],
  },
];

export function inferCategory(productName: string): MacroCategory {
  if (!productName) return "altro";
  const lc = productName.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((k) => lc.includes(k))) {
      return rule.category;
    }
  }
  return "altro";
}

export const MACRO_CATEGORY_LABELS: Record<MacroCategory, string> = {
  carne: "Carne",
  pesce: "Pesce",
  verdura: "Verdura",
  frutta: "Frutta",
  latticini: "Latticini",
  secco: "Dispensa",
  bevande: "Bevande",
  surgelati: "Surgelati",
  panetteria: "Panetteria",
  altro: "Altro",
};
