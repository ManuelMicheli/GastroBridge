// Ho.Re.Ca. abbreviation lexicon.
//
// Keys are folded (lowercase, no accents) and written WITHOUT the trailing
// dot; the expander matches "pomod." and "pomod" alike. Multi-word keys
// ("fdl", "e.v.o.") are matched as whole tokens after dot-collapsing.

export const ABBREVIATIONS: Record<string, string> = {
  // --- ortofrutta
  pomod: "pomodori", pom: "pomodori", pomodor: "pomodori", pomodo: "pomodori",
  datt: "datterini", dattr: "datterini", cil: "ciliegini", cilieg: "ciliegini", cuor: "cuore", "cuor bue": "cuore di bue",
  ins: "insalata", insal: "insalata", lattug: "lattuga", rad: "radicchio", radic: "radicchio",
  pat: "patate", patat: "patate", cip: "cipolle", cipol: "cipolle", carc: "carciofi", carciof: "carciofi",
  zucch: "zucchine", zuc: "zucchine", melanz: "melanzane", mel: "melanzane", pep: "peperoni", peper: "peperoni",
  fin: "finocchi", finoc: "finocchi", car: "carote", carot: "carote", sed: "sedano", spin: "spinaci",
  broc: "broccoli", brocc: "broccoli", cavolf: "cavolfiore", rucol: "rucola", bas: "basilico", basil: "basilico",
  prezz: "prezzemolo", rosm: "rosmarino", fung: "funghi", champ: "champignon", porc: "porcini",
  lim: "limoni", limon: "limoni", aran: "arance", aranc: "arance", mand: "mandarini", fragol: "fragole",
  frag: "fragole", mirt: "mirtilli", lamp: "lamponi", ban: "banane", anan: "ananas",
  // --- latticini
  mozz: "mozzarella", mozzar: "mozzarella", mozzarel: "mozzarella", fdl: "fior di latte", "fior d latte": "fior di latte",
  buf: "bufala", bufal: "bufala", "mozz buf": "mozzarella di bufala", stracc: "stracciatella", stracciat: "stracciatella",
  burr: "burrata", parm: "parmigiano", parmig: "parmigiano", "parm reg": "parmigiano reggiano", reg: "reggiano",
  regg: "reggiano", gp: "grana padano", "gr pad": "grana padano", pad: "padano",
  grat: "grattugiato", gratt: "grattugiato", pec: "pecorino", pecor: "pecorino", rom: "romano", gorg: "gorgonzola",
  ricot: "ricotta", ric: "ricotta", masc: "mascarpone", mascarp: "mascarpone", prov: "provola", scam: "scamorza",
  affum: "affumicata", stag: "stagionato", form: "formaggio", formag: "formaggio", lat: "latte",
  ps: "parzialmente scremato",
  // --- salumi / carne
  prosc: "prosciutto", pros: "prosciutto", prosciut: "prosciutto", cr: "crudo", cot: "cotto", mortad: "mortadella",
  mort: "mortadella", sal: "salame", salsic: "salsiccia", salsicc: "salsiccia", guanc: "guanciale", panc: "pancetta",
  bres: "bresaola", fil: "filetto", filett: "filetto", pet: "petto", sovracc: "sovracoscia", cosc: "coscia",
  maci: "macinato", macin: "macinato", vit: "vitello", vitel: "vitello", mzo: "manzo", manz: "manzo",
  pol: "pollo", poll: "pollo", tacch: "tacchino", maial: "maiale", agn: "agnello", costat: "costata",
  hamb: "hamburger", sv: "sottovuoto", sottov: "sottovuoto",
  // --- pesce
  salm: "salmone", merl: "merluzzo", bacc: "baccalà", gamb: "gamberi", gamber: "gamberi",
  gamberon: "gamberoni", calam: "calamari", seppi: "seppie", polp: "polpo", vong: "vongole", cozz: "cozze",
  bran: "branzino", branz: "branzino", ora: "orata", tonn: "tonno", acc: "acciughe", acciug: "acciughe",
  // --- dispensa
  ev: "extravergine", evo: "extravergine di oliva",
  extraverg: "extravergine", extrav: "extravergine", oliv: "oliva", "olio sem": "olio di semi", sem: "semi",
  gir: "girasole", far: "farina", farin: "farina", semol: "semola", rimac: "rimacinata",
  rim: "rimacinata", spagh: "spaghetti", spag: "spaghetti", tagl: "tagliatelle", rig: "rigatoni",
  conc: "concentrato", pass: "passata", pel: "pelati", pelat: "pelati",
  zuccher: "zucchero", acet: "aceto", bals: "balsamico", balsam: "balsamico", mod: "modena", lievit: "lievito",
  cioc: "cioccolato", ciocc: "cioccolato", fondent: "fondente", marm: "marmellata",
  // --- bevande
  acq: "acqua", nat: "naturale", natur: "naturale", friz: "frizzante", frizz: "frizzante", gas: "gassata",
  birr: "birra", vin: "vino", ros: "rosso", bco: "bianco", bian: "bianco", spum: "spumante",
  succ: "succo", aranciat: "aranciata",
  // --- surgelati / varie
  surg: "surgelato", surgel: "surgelato", cong: "congelato", congel: "congelato", decong: "decongelato",
  fr: "fresco", fresc: "fresco", frsc: "fresco", nostr: "nostrano", naz: "nazionale", imp: "importazione",
  ital: "italiano", it: "italia", sic: "siciliano", camp: "campano", pugl: "pugliese", bio: "BIO",
  cat: "categoria", cal: "calibro", sel: "selezione", picc: "piccolo",
  med: "medio", gros: "grosso", tag: "taglio", tagliat: "tagliato", aff: "affettato", affett: "affettato",
  intr: "intero", int: "intero", mz: "mezzo",
  // --- pulizia / packaging
  det: "detergente", deterg: "detergente", sgrass: "sgrassatore", igien: "igienizzante", disinf: "disinfettante",
  tov: "tovaglioli", tovagl: "tovaglioli", vasch: "vaschette", allum: "alluminio", pellic: "pellicola",
  guant: "guanti", nitr: "nitrile", monous: "monouso", sacch: "sacchetti",
};

/** Tokens that look like abbreviations but must never be expanded. */
const NEVER_EXPAND = new Set(["di", "da", "al", "la", "il", "in", "con", "per", "e", "a", "o", "x", "su", "del", "dei", "delle"]);

/** Short tokens expanded only when written with a trailing dot ("mel." yes, "mel" in "mela" no). */
const DOT_REQUIRED = new Set([
  "pom", "ins", "pat", "cip", "car", "sed", "fin", "mel", "pep", "lim", "ban", "lat", "pet", "pol", "sal", "ora",
  "acc", "far", "sem", "gir", "rig", "pel", "nat", "gas", "vin", "ros", "fr", "it", "sic", "camp", "cat", "cal",
  "sel", "med", "tag", "aff", "int", "mz", "det", "tov", "rom", "pec", "ric", "prov", "form", "reg", "pad",
  "pass", "mod", "conc", "cot", "cr", "mort", "fil", "agn", "spin", "bas", "mand", "frag", "anan", "zuc", "ev",
  "gp", "naz", "imp", "picc", "gros", "intr", "pros", "bres", "maci", "vit", "rad", "fung", "porc", "rim",
  "succ", "acq", "friz", "birr", "bian", "spum", "surg", "cong", "fresc", "nostr", "ital", "pugl", "stag", "grat",
  "bran", "polp", "vong", "cozz", "tonn", "salm", "merl", "bacc", "gamb", "calam", "panc", "guanc", "cosc", "manz",
  "poll", "tacch", "hamb", "sv", "ps", "mzo", "aran", "broc", "champ", "prezz", "rosm", "mirt", "lamp", "datt", "cil",
  "buf", "burr", "parm", "regg", "gratt", "masc", "scam", "affum", "lievit", "bals", "acet", "cioc", "ciocc", "marm",
  "allum", "pellic", "guant", "nitr", "sacch", "igien", "disinf", "deterg", "sgrass", "tovagl", "vasch",
]);

const ALWAYS = new Set(["fdl", "evo", "gp"]);

export type ExpandResult = { text: string; expanded: string[]; unknown: string[] };

/**
 * Expand abbreviations in a product name. `extra` contains learned
 * abbreviations (import memory), which win over the built-in lexicon.
 */
export function expandAbbreviations(name: string, extra: Record<string, string> = {}): ExpandResult {
  const expanded: string[] = [];
  const unknown: string[] = [];
  // Collapse dotted acronyms: "e.v.o." → "evo", "f.d.l." → "fdl"
  let text = name.replace(/\b((?:[a-zA-Z]\.){2,4})(?=\s|$)/g, (m) => m.replace(/\./g, ""));

  // Two-word keys first ("mozz buf", "parm reg", "olio sem").
  const twoWord = Object.keys(ABBREVIATIONS).filter((k) => k.includes(" "));
  for (const k of twoWord) {
    const re = new RegExp(String.raw`(^|\s)${k.split(" ").map((p) => `${p}\\.?`).join("\\s*")}(?=\s|$|,)`, "gi");
    text = text.replace(re, (m, pre: string) => {
      expanded.push(k);
      return `${pre}${ABBREVIATIONS[k]}`;
    });
  }

  const out = text.split(/(\s+)/).map((tok) => {
    if (/^\s+$/.test(tok) || !tok) return tok;
    const m = /^([("']*)([A-Za-zÀ-ú]+)(\.?)([)"',;:]*)$/.exec(tok);
    if (!m) return tok;
    const [, pre, word, dot, post] = m;
    const key = word!.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (NEVER_EXPAND.has(key)) return tok;
    const learned = extra[key];
    if (learned) {
      expanded.push(key);
      return `${pre}${learned}${post}`;
    }
    const exp = ABBREVIATIONS[key];
    if (exp) {
      const needsDot = DOT_REQUIRED.has(key) && !ALWAYS.has(key);
      // Uppercase short tokens in lists ("FDL", "EVO", "SV") are abbreviations even without a dot.
      const isUpperAbbrev = word!.length <= 4 && word === word!.toUpperCase() && word!.length >= 2;
      if (!needsDot || dot || isUpperAbbrev) {
        expanded.push(key);
        return `${pre}${exp}${post}`;
      }
      return tok;
    }
    if (dot && key.length >= 2 && key.length <= 6) unknown.push(`${word}.`);
    return tok;
  });
  text = out.join("").replace(/\s+/g, " ").trim();
  return { text, expanded, unknown };
}
