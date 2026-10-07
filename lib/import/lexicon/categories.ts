// Weighted category classifier for product names.
//
// Extends the analytics keyword rules (lib/analytics/category-keywords.ts) with
// weights, more Ho.Re.Ca. vocabulary, non-food categories and explanations.
// Categories map onto `products.macro_category` and onto the platform
// `categories` table (by slug) for supplier imports.

import { inferCategory, type MacroCategory } from "../../analytics/category-keywords.ts";
import { fold } from "../text.ts";

export type { MacroCategory };

export type ImportCategory = MacroCategory | "packaging" | "pulizia" | "attrezzature";

export const IMPORT_CATEGORIES: ImportCategory[] = [
  "verdura", "frutta", "carne", "pesce", "latticini", "panetteria", "secco", "bevande", "surgelati",
  "packaging", "pulizia", "attrezzature", "altro",
];

export const CATEGORY_LABELS: Record<ImportCategory, string> = {
  verdura: "Verdura",
  frutta: "Frutta",
  carne: "Carne e salumi",
  pesce: "Pesce",
  latticini: "Latticini e uova",
  panetteria: "Panetteria",
  secco: "Dispensa",
  bevande: "Bevande",
  surgelati: "Surgelati",
  packaging: "Packaging",
  pulizia: "Pulizia",
  attrezzature: "Attrezzature",
  altro: "Altro",
};

/** products.macro_category value for an import category. */
export function toMacro(c: ImportCategory): MacroCategory {
  return c === "packaging" || c === "pulizia" || c === "attrezzature" ? "altro" : c;
}

/** Slug of the platform `categories` row (seed: food-fresco, food-secco, …). */
export function platformCategorySlug(c: ImportCategory): string {
  switch (c) {
    case "verdura":
    case "frutta":
    case "carne":
    case "pesce":
    case "latticini":
    case "panetteria":
      return "food-fresco";
    case "secco":
      return "food-secco";
    case "bevande":
      return "bevande";
    case "surgelati":
      return "surgelati";
    case "packaging":
      return "packaging";
    case "pulizia":
      return "cleaning";
    case "attrezzature":
      return "attrezzature";
    default:
      return "food-secco";
  }
}

type W = [string, number];

// Stems are matched at the start of a folded word ("pomodor" → "pomodori",
// "pomodorini"). Multi-word stems match as phrases. Weight 3 = defining word,
// 2 = strong, 1 = weak hint.
const LEXICON: Record<ImportCategory, W[]> = {
  surgelati: [["surgelat", 5], ["congelat", 5], ["frozen", 4], ["iqf", 4], ["abbattut", 3], ["gelato", 2], ["gelati", 2], ["sorbett", 2], ["ghiacciol", 2]],
  verdura: [
    ["pomodor", 3], ["datterin", 3], ["ciliegin", 3], ["cuore di bue", 3], ["san marzano", 2], ["patat", 3], ["cipoll", 3], ["carot", 3],
    ["zucchin", 3], ["zucca", 3], ["melanzan", 3], ["peperon", 3], ["insalat", 3], ["lattug", 3], ["rucol", 3], ["spinac", 3],
    ["broccol", 3], ["cavol", 3], ["cavolfior", 3], ["verza", 3], ["finocch", 3], ["sedano", 3], ["radicchi", 3], ["indivia", 3],
    ["scarola", 3], ["asparag", 3], ["aglio", 3], ["porr", 2], ["carciof", 3], ["fagiolin", 3], ["piselli", 2], ["fave", 2],
    ["funghi", 3], ["fungo", 3], ["champignon", 3], ["porcin", 3], ["cardoncell", 3], ["basilico", 3], ["prezzemol", 3],
    ["rosmarin", 3], ["salvia", 3], ["menta", 2], ["timo", 2], ["origano", 1], ["erba cipollina", 3], ["aromatic", 2],
    ["cetriol", 3], ["ravanell", 3], ["barbabietol", 3], ["rapa", 2], ["cime di rapa", 3], ["friarielli", 3], ["bietol", 3],
    ["valerian", 3], ["songino", 3], ["germogli", 2], ["misticanza", 3], ["patate dolci", 3], ["topinambur", 3], ["scalogn", 3],
    ["zenzero", 2], ["peperoncin", 2], ["verdur", 3], ["ortaggi", 3], ["friggitell", 3], ["cavolo nero", 3], ["catalogna", 3],
    ["puntarell", 3], ["mais", 1], ["pannocchi", 3], ["avocado", 2],
  ],
  frutta: [
    ["limon", 3], ["arance", 3], ["arancia", 3], ["arancie", 3], ["mandarin", 3], ["clementin", 3], ["pompelm", 3], ["lime", 3],
    ["mela", 3], ["mele", 3], ["pera", 3], ["pere", 3], ["banan", 3], ["fragol", 3], ["lampon", 3], ["mirtill", 3], ["more", 1],
    ["ribes", 3], ["uva", 3], ["anguria", 3], ["cocomer", 3], ["melone", 3], ["meloni", 3], ["pesca", 2], ["pesche", 3],
    ["nettarin", 3], ["albicocc", 3], ["susin", 3], ["prugn", 3], ["ciliegie", 3], ["kiwi", 3], ["ananas", 3], ["mango", 3],
    ["papaya", 3], ["melograno", 3], ["fichi", 3], ["fico", 2], ["cachi", 3], ["kaki", 3], ["castagn", 3], ["noci", 2],
    ["nocciol", 2], ["mandorl", 2], ["pistacchi", 2], ["frutta", 3], ["frutti di bosco", 3], ["passion fruit", 3], ["maracuja", 3],
    ["cedro", 2], ["bergamott", 3],
  ],
  carne: [
    ["pollo", 3], ["polli", 3], ["manzo", 3], ["vitell", 3], ["vitellone", 3], ["scottona", 3], ["maiale", 3], ["suino", 3],
    ["agnell", 3], ["capretto", 3], ["tacchin", 3], ["coniglio", 3], ["anatra", 3], ["faraona", 3], ["cavallo", 3], ["bovino", 3],
    ["prosciutt", 3], ["salame", 3], ["salami", 3], ["salsicc", 3], ["bresaola", 3], ["speck", 3], ["pancetta", 3], ["guancial", 3],
    ["mortadell", 3], ["coppa", 3], ["capocollo", 3], ["lardo", 3], ["culatell", 3], ["wurstel", 3], ["cotechino", 3],
    ["zampone", 3], ["nduja", 3], ["porchetta", 3], ["hamburger", 3], ["burger", 2], ["macinat", 3], ["bistecc", 3], ["costat", 3],
    ["fiorentina", 3], ["tagliata", 2], ["filetto", 1], ["controfiletto", 3], ["entrecote", 3], ["roastbeef", 3], ["roast beef", 3],
    ["spezzatino", 3], ["ossobuco", 3], ["fesa", 3], ["noce di", 1], ["girello", 3], ["lombo", 3], ["lonza", 3], ["arista", 3],
    ["costine", 3], ["ribs", 3], ["petto", 1], ["cosce", 2], ["coscia", 2], ["sovracosc", 3], ["ali di pollo", 3], ["fegat", 2],
    ["trippa", 3], ["carne", 3], ["carpaccio", 1], ["salumi", 3], ["affettat", 2], ["cotto", 1], ["crudo", 1], ["tartare", 1],
    ["galletto", 3], ["quaglie", 3], ["piccione", 3], ["cinghiale", 3], ["cervo", 3], ["bacon", 3], ["chorizo", 3], ["salsiccia", 3],
  ],
  pesce: [
    ["salmon", 3], ["merluzz", 3], ["baccal", 3], ["stoccafisso", 3], ["tonno", 3], ["branzin", 3], ["spigola", 3], ["orata", 3],
    ["sgombr", 3], ["sardin", 3], ["sarde", 3], ["acciug", 3], ["alici", 3], ["gamber", 3], ["mazzancoll", 3], ["scampi", 3],
    ["calamar", 3], ["totani", 3], ["seppi", 3], ["polp", 3], ["moscardin", 3], ["vongol", 3], ["cozze", 3], ["cozza", 3],
    ["ostrich", 3], ["capesant", 3], ["telline", 3], ["fasolari", 3], ["granchi", 3], ["astice", 3], ["aragost", 3], ["pesce", 3],
    ["rombo", 3], ["sogliola", 3], ["platessa", 3], ["pesce spada", 3], ["spada", 2], ["ricciola", 3], ["dentice", 3], ["pagello", 3],
    ["triglia", 3], ["trota", 3], ["cernia", 3], ["nasello", 3], ["halibut", 3], ["frutti di mare", 3], ["bottarga", 3], ["crostace", 3],
    ["molluschi", 3], ["sushi", 1], ["filetti di", 1], ["tranci", 1], ["ricci di mare", 3], ["anguilla", 3], ["sashimi", 2],
  ],
  latticini: [
    ["mozzarell", 3], ["fior di latte", 3], ["bufala", 2], ["burrata", 3], ["stracciatella", 3], ["parmigian", 3], ["grana", 3],
    ["padano", 2], ["reggiano", 2], ["burro", 3], ["panna", 3], ["latte", 3], ["yogurt", 3], ["ricotta", 3], ["mascarpone", 3],
    ["pecorino", 3], ["gorgonzola", 3], ["stracchino", 3], ["crescenza", 3], ["taleggio", 3], ["fontina", 3], ["asiago", 3],
    ["emmental", 3], ["cheddar", 3], ["provola", 3], ["provolone", 3], ["caciocavallo", 3], ["scamorza", 3], ["robiola", 3],
    ["formaggi", 3], ["formaggio", 3], ["caprino", 3], ["primo sale", 3], ["feta", 3], ["brie", 3], ["camembert", 3], ["edamer", 3],
    ["montasio", 3], ["bitto", 2], ["castelmagno", 3], ["fiordilatte", 3], ["uova", 3], ["uovo", 3], ["tuorl", 3], ["albume", 3],
    ["kefir", 3], ["philadelphia", 2], ["spalmabile", 1], ["latticin", 3], ["smetana", 2], ["crème fraiche", 3], ["creme fraiche", 3],
  ],
  panetteria: [
    ["pane", 3], ["panini", 3], ["panino", 3], ["baguette", 3], ["focacc", 3], ["piadin", 3], ["pinsa", 3], ["base pizza", 3],
    ["brioche", 3], ["cornett", 3], ["croissant", 3], ["grissin", 3], ["cracker", 2], ["fette biscottate", 3], ["taralli", 2],
    ["friselle", 3], ["ciabatta", 3], ["rosetta", 3], ["pan carre", 3], ["pancarre", 3], ["tramezzin", 3], ["bun", 2],
    ["pane grattugiato", 3], ["pangrattato", 3], ["torta", 2], ["torte", 2], ["crostat", 2], ["pasticceria", 3], ["dolci", 2],
    ["biscott", 2], ["muffin", 3], ["plumcake", 3], ["cannoli", 2], ["sfogliatell", 3], ["bigne", 2], ["tiramis", 2],
  ],
  secco: [
    ["farina", 3], ["semola", 3], ["pasta", 3], ["spaghett", 3], ["penne", 3], ["rigaton", 3], ["linguin", 3], ["tagliatell", 2],
    ["fusill", 3], ["paccheri", 3], ["orecchiett", 3], ["mezze maniche", 3], ["bucatini", 3], ["vermicell", 3], ["lasagne", 2],
    ["gnocchi", 2], ["riso", 3], ["carnaroli", 3], ["arborio", 3], ["basmati", 3], ["orzo", 2], ["farro", 3], ["couscous", 3],
    ["quinoa", 3], ["polenta", 3], ["zucchero", 3], ["sale ", 2], ["sale fino", 3], ["sale grosso", 3], ["pepe", 2], ["olio", 3],
    ["extravergine", 3], ["aceto", 3], ["balsamico", 3], ["lievito", 3], ["cioccolat", 2], ["cacao", 3], ["vanigli", 2],
    ["cannella", 2], ["spezie", 3], ["legumi", 3], ["ceci", 2], ["lenticchie", 2], ["fagioli", 2], ["conserv", 3], ["passata", 3],
    ["concentrato", 3], ["pelati", 3], ["polpa di pomodoro", 3], ["scatolame", 3], ["tonno in scatola", 3], ["capperi", 3],
    ["olive", 2], ["sottoli", 3], ["sottaceti", 3], ["maionese", 3], ["ketchup", 3], ["senape", 3], ["salsa", 2], ["sugo", 2],
    ["pesto", 2], ["dado", 3], ["brodo", 2], ["miele", 3], ["marmellat", 3], ["confettur", 3], ["nutella", 3], ["crema spalmabile", 3],
    ["caffe", 2], ["orzo solubile", 3], ["the ", 1], ["tisan", 2], ["camomill", 2], ["cereali", 2], ["muesli", 3], ["frutta secca", 3],
    ["pinoli", 3], ["noci sgusciate", 3], ["semi di", 2], ["amido", 3], ["fecola", 3], ["maizena", 3], ["pangrattato", 1],
    ["glutammato", 3], ["bicarbonato", 3], ["gelatina", 2], ["colla di pesce", 3], ["zucchero a velo", 3], ["sciroppo", 2],
  ],
  bevande: [
    ["vino", 3], ["vini", 3], ["rosso", 1], ["bianco", 1], ["birra", 3], ["birre", 3], ["acqua", 3], ["minerale", 2],
    ["frizzante", 1], ["naturale", 1], ["succo", 3], ["succhi", 3], ["bibita", 3], ["bibite", 3], ["cola", 3], ["aranciata", 3],
    ["limonata", 3], ["chinotto", 3], ["gassosa", 3], ["tonica", 3], ["acqua tonica", 3], ["ginger", 2], ["energy drink", 3],
    ["spritz", 3], ["aperitiv", 3], ["aperol", 3], ["campari", 3], ["liquor", 3], ["grappa", 3], ["amaro", 3], ["amari", 3],
    ["limoncello", 3], ["sambuca", 3], ["vodka", 3], ["gin", 3], ["rum", 3], ["whisky", 3], ["whiskey", 3], ["tequila", 3],
    ["vermouth", 3], ["champagne", 3], ["prosecco", 3], ["spumante", 3], ["franciacorta", 3], ["lambrusco", 3], ["chianti", 3],
    ["barolo", 3], ["brunello", 3], ["montepulciano", 3], ["primitivo", 3], ["nero d'avola", 3], ["vermentino", 3],
    ["pinot", 3], ["chardonnay", 3], ["sauvignon", 3], ["merlot", 3], ["cabernet", 3], ["sangiovese", 3], ["falanghina", 3],
    ["igt", 1], ["docg", 2], ["doc", 1], ["sciroppo per", 2], ["caffe in grani", 3], ["caffe macinato", 3], ["capsule", 2],
    ["cialde", 2], ["te freddo", 3], ["estathe", 3], ["kombucha", 3], ["sidro", 3], ["bevand", 3], ["drink", 2], ["tè", 1],
  ],
  packaging: [
    ["vaschett", 3], ["contenitor", 3], ["alluminio", 2], ["pellicola", 3], ["carta forno", 3], ["carta da forno", 3], ["tovaglio", 3],
    ["tovagliett", 3], ["piatti", 2], ["bicchier", 2], ["posate", 3], ["forchett", 2], ["cucchiai", 2], ["coltell", 1],
    ["cannucc", 3], ["sacchett", 3], ["shopper", 3], ["buste", 2], ["scatola pizza", 3], ["cartoni pizza", 3], ["box pizza", 3],
    ["coperchi", 3], ["monouso", 3], ["compostabil", 3], ["asporto", 2], ["take away", 3], ["vassoi", 2], ["pirottin", 3],
    ["rotolo", 1], ["carta", 1], ["etichett", 2],
  ],
  pulizia: [
    ["detergent", 3], ["detersiv", 3], ["sgrassator", 3], ["igienizzant", 3], ["disinfettant", 3], ["sanificant", 3],
    ["candeggin", 3], ["ammoniaca", 3], ["brillantant", 3], ["anticalcare", 3], ["lavastoviglie", 3], ["lavapavimenti", 3],
    ["sapone", 3], ["spugn", 3], ["panno", 3], ["panni", 3], ["guanti", 3], ["nitrile", 3], ["lattice", 2], ["carta igienica", 3],
    ["asciugaman", 2], ["bobina", 3], ["sacchi neri", 3], ["sacchi spazzatura", 3], ["mocio", 3], ["scopa", 3], ["alcool", 2],
    ["pulizia", 3], ["pulitor", 3], ["cloro", 3], ["deodorant", 2], ["deterg", 3],
  ],
  attrezzature: [
    ["pentol", 3], ["padell", 3], ["tegame", 3], ["teglia", 3], ["teglie", 3], ["coltelli", 3], ["tagliere", 3], ["mestol", 3],
    ["frusta", 3], ["termometro", 3], ["bilancia", 3], ["affettatrice", 3], ["planetaria", 3], ["frullatore", 3], ["mixer", 3],
    ["sottovuoto macchina", 3], ["abbattitore", 3], ["forno", 2], ["friggitrice", 3], ["piastra", 2], ["gastronorm", 3],
    ["contenitori gn", 3], ["attrezz", 3], ["utensil", 3], ["divisa", 3], ["grembiul", 3], ["cappello cuoco", 3],
  ],
  altro: [],
};

// Pre-fold the lexicon once.
const FOLDED: Array<[ImportCategory, string, number]> = [];
for (const [cat, list] of Object.entries(LEXICON) as Array<[ImportCategory, W[]]>) {
  for (const [stem, w] of list) FOLDED.push([cat, fold(stem), w]);
}

export type CategoryGuess = {
  category: ImportCategory;
  /** 0–1 */
  confidence: number;
  reason: string;
};

/** Words that flip a fresh product to frozen/dry regardless of the noun. */
const CONTEXT_OVERRIDES: Array<[RegExp, ImportCategory, number]> = [
  [/\b(surgelat|congelat|frozen|iqf)/, "surgelati", 6],
  [/\b(in scatola|sott'?olio|sottolio|all'olio|al naturale|in salamoia|essiccat|secchi\b|disidratat|liofilizzat|in vasetto|in barattolo|in latta|in vetro|conserv)/, "secco", 4],
  [/\b(succo|nettare|spremut)/, "bevande", 3],
];

/**
 * Score a product name against the lexicon.
 * `sectionHint` is the category of the heading the product sits under
 * ("FRUTTA", sheet named "Latticini", …) and weighs as a strong signal.
 */
export function classifyCategory(name: string, sectionHint?: ImportCategory | null): CategoryGuess {
  const f = ` ${fold(name).replace(/[^a-z0-9' ]+/g, " ")} `;
  const scores = new Map<ImportCategory, number>();
  const hits = new Map<ImportCategory, string[]>();
  for (const [cat, stem, w] of FOLDED) {
    const needle = ` ${stem}`;
    if (f.includes(needle)) {
      scores.set(cat, (scores.get(cat) ?? 0) + w);
      const list = hits.get(cat) ?? [];
      list.push(stem.trim());
      hits.set(cat, list);
    }
  }
  for (const [re, cat, w] of CONTEXT_OVERRIDES) {
    if (re.test(f)) scores.set(cat, (scores.get(cat) ?? 0) + w);
  }
  if (sectionHint && sectionHint !== "altro") {
    scores.set(sectionHint, (scores.get(sectionHint) ?? 0) + 3);
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  if (!top || top[1] <= 0) {
    // Last resort: the original analytics rules (substring based).
    const legacy = inferCategory(name);
    if (legacy !== "altro") {
      return { category: legacy, confidence: 0.5, reason: "Categoria dedotta da una parola del nome" };
    }
    return { category: "altro", confidence: 0.2, reason: "Nessuna parola chiave riconosciuta" };
  }
  const second = ranked[1]?.[1] ?? 0;
  const margin = top[1] - second;
  let confidence = Math.min(0.97, 0.45 + Math.min(top[1], 6) * 0.07 + Math.min(margin, 4) * 0.05);
  if (second > 0 && margin <= 1) confidence = Math.min(confidence, 0.6);
  const words = hits.get(top[0])?.slice(0, 2).join(", ");
  const reason =
    sectionHint === top[0] && !words
      ? `Sezione del documento: ${CATEGORY_LABELS[top[0]]}`
      : words
        ? `Riconosciuto da “${words}”${sectionHint === top[0] ? " e dalla sezione" : ""}`
        : `Categoria ${CATEGORY_LABELS[top[0]]}`;
  return { category: top[0], confidence: Math.round(confidence * 100) / 100, reason };
}

/** Category named by a heading or sheet name ("FRUTTA E VERDURA", "Latticini"). */
export function categoryFromHeading(heading: string): ImportCategory | null {
  const f = fold(heading);
  const table: Array<[RegExp, ImportCategory]> = [
    [/surgelat|congelat|frozen/, "surgelati"],
    [/\bfrutta\b(?!.*verdur)/, "frutta"],
    [/verdur|ortaggi|ortofrutt|orto\b|insalate|aromatich/, "verdura"],
    [/carn|salum|macelleri|pollam|affettat|norcineri/, "carne"],
    [/pesc|ittic|mare\b|crostace|mollusc/, "pesce"],
    [/latticin|formagg|caseari|uova|dairy/, "latticini"],
    [/pane|panetter|forno|pasticcer|dolci|lievitat/, "panetteria"],
    [/bevand|vini|vino|birre|birra|liquor|distillat|acque|bibite|cantina|bar\b|caffetteria/, "bevande"],
    [/dispensa|secco|scatolame|conserve|pasta|farine|oli\b|condiment|spezie|drogheri|alimentari/, "secco"],
    [/packaging|imballagg|monouso|asporto|take away/, "packaging"],
    [/pulizi|detergen|igiene|chimic/, "pulizia"],
    [/attrezzatur|utensil|casalinghi/, "attrezzature"],
  ];
  for (const [re, cat] of table) if (re.test(f)) return cat;
  return null;
}
