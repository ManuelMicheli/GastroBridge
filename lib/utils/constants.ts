import type { PlanType } from "@/types/database";

// ==========================================
// Routes
// ==========================================

export const ROUTES = {
  // Marketing
  HOME: "/",
  PRICING: "/pricing",
  FOR_SUPPLIERS: "/fornitori",

  // Auth
  LOGIN: "/login",
  SIGNUP: "/signup",

  // Restaurant App
  DASHBOARD: "/dashboard",
  SEARCH: "/cerca",
  PRODUCT: (id: string) => `/cerca/${id}` as const,
  SUPPLIERS: "/fornitori",
  SUPPLIER: (id: string) => `/fornitori/${id}` as const,
  ORDERS: "/ordini",
  ORDER: (id: string) => `/ordini/${id}` as const,
  CART: "/carrello",
  ANALYTICS: "/analytics",
  SETTINGS: "/impostazioni",
  SETTINGS_LOCATIONS: "/impostazioni/sedi",
  SETTINGS_TEAM: "/impostazioni/team",
  SETTINGS_SUBSCRIPTION: "/impostazioni/abbonamento",

  // Supplier App
  SUPPLIER_DASHBOARD: "/supplier/dashboard",
  SUPPLIER_CATALOG: "/supplier/catalogo",
  SUPPLIER_CATALOG_NEW: "/supplier/catalogo/nuovo",
  SUPPLIER_CATALOG_EDIT: (id: string) => `/supplier/catalogo/${id}` as const,
  SUPPLIER_CATALOG_IMPORT: "/supplier/catalogo/import",
  SUPPLIER_ORDERS: "/supplier/ordini",
  SUPPLIER_ORDER: (id: string) => `/supplier/ordini/${id}` as const,
  SUPPLIER_CLIENTS: "/supplier/clienti",
  SUPPLIER_ANALYTICS: "/supplier/analytics",
  SUPPLIER_REVIEWS: "/supplier/recensioni",
  SUPPLIER_SETTINGS: "/supplier/impostazioni",
  SUPPLIER_SETTINGS_ZONES: "/supplier/impostazioni/zone",
  SUPPLIER_SETTINGS_SUBSCRIPTION: "/supplier/impostazioni/abbonamento",
} as const;

// ==========================================
// Subscription Plans
// ==========================================

export type PlanDefinition = {
  id: PlanType;
  name: string;
  price: number;
  period: "mese";
  features: string[];
  highlighted?: boolean;
  stripePriceEnv?: string;
};

export const RESTAURANT_PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: "mese",
    features: [
      "Ricerca fornitori",
      "Confronto prezzi base",
      "Fino a 10 ordini/mese",
      "1 sede",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 49,
    period: "mese",
    highlighted: true,
    stripePriceEnv: "STRIPE_PRICE_RESTAURANT_PRO",
    features: [
      "Tutto di Free +",
      "Ordini illimitati",
      "Alert risparmio",
      "Analytics spesa",
      "Fino a 3 sedi",
      "Template ordini",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: 99,
    period: "mese",
    stripePriceEnv: "STRIPE_PRICE_RESTAURANT_BUSINESS",
    features: [
      "Tutto di Pro +",
      "Sedi illimitate",
      "Team multi-utente",
      "API access",
      "Support prioritario",
      "Report personalizzati",
    ],
  },
];

export const SUPPLIER_PLANS: PlanDefinition[] = [
  {
    id: "base",
    name: "Base",
    price: 79,
    period: "mese",
    stripePriceEnv: "STRIPE_PRICE_SUPPLIER_BASE",
    features: [
      "Profilo fornitore",
      "Fino a 100 prodotti",
      "Gestione ordini",
      "1 zona di consegna",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    price: 149,
    period: "mese",
    highlighted: true,
    stripePriceEnv: "STRIPE_PRICE_SUPPLIER_GROWTH",
    features: [
      "Tutto di Base +",
      "Prodotti illimitati",
      "Import CSV",
      "Analytics avanzati",
      "Zone illimitate",
      "Badge verificato",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 299,
    period: "mese",
    stripePriceEnv: "STRIPE_PRICE_SUPPLIER_ENTERPRISE",
    features: [
      "Tutto di Growth +",
      "API dedicata",
      "Account manager",
      "Integrazioni custom",
      "SLA garantito",
      "Priorità nei risultati",
    ],
  },
];

// ==========================================
// Italian Provinces (Nord Italia focus)
// ==========================================

export const PROVINCES = [
  // Lombardia
  { code: "MI", name: "Milano", region: "Lombardia" },
  { code: "BG", name: "Bergamo", region: "Lombardia" },
  { code: "BS", name: "Brescia", region: "Lombardia" },
  { code: "CO", name: "Como", region: "Lombardia" },
  { code: "CR", name: "Cremona", region: "Lombardia" },
  { code: "LC", name: "Lecco", region: "Lombardia" },
  { code: "LO", name: "Lodi", region: "Lombardia" },
  { code: "MN", name: "Mantova", region: "Lombardia" },
  { code: "MB", name: "Monza e Brianza", region: "Lombardia" },
  { code: "PV", name: "Pavia", region: "Lombardia" },
  { code: "SO", name: "Sondrio", region: "Lombardia" },
  { code: "VA", name: "Varese", region: "Lombardia" },
  // Piemonte
  { code: "TO", name: "Torino", region: "Piemonte" },
  { code: "AL", name: "Alessandria", region: "Piemonte" },
  { code: "AT", name: "Asti", region: "Piemonte" },
  { code: "BI", name: "Biella", region: "Piemonte" },
  { code: "CN", name: "Cuneo", region: "Piemonte" },
  { code: "NO", name: "Novara", region: "Piemonte" },
  { code: "VB", name: "Verbano-Cusio-Ossola", region: "Piemonte" },
  { code: "VC", name: "Vercelli", region: "Piemonte" },
  // Veneto
  { code: "VE", name: "Venezia", region: "Veneto" },
  { code: "BL", name: "Belluno", region: "Veneto" },
  { code: "PD", name: "Padova", region: "Veneto" },
  { code: "RO", name: "Rovigo", region: "Veneto" },
  { code: "TV", name: "Treviso", region: "Veneto" },
  { code: "VI", name: "Vicenza", region: "Veneto" },
  { code: "VR", name: "Verona", region: "Veneto" },
  // Emilia-Romagna
  { code: "BO", name: "Bologna", region: "Emilia-Romagna" },
  { code: "FE", name: "Ferrara", region: "Emilia-Romagna" },
  { code: "FC", name: "Forli-Cesena", region: "Emilia-Romagna" },
  { code: "MO", name: "Modena", region: "Emilia-Romagna" },
  { code: "PR", name: "Parma", region: "Emilia-Romagna" },
  { code: "PC", name: "Piacenza", region: "Emilia-Romagna" },
  { code: "RA", name: "Ravenna", region: "Emilia-Romagna" },
  { code: "RE", name: "Reggio Emilia", region: "Emilia-Romagna" },
  { code: "RN", name: "Rimini", region: "Emilia-Romagna" },
  // Friuli-Venezia Giulia
  { code: "GO", name: "Gorizia", region: "Friuli-Venezia Giulia" },
  { code: "PN", name: "Pordenone", region: "Friuli-Venezia Giulia" },
  { code: "TS", name: "Trieste", region: "Friuli-Venezia Giulia" },
  { code: "UD", name: "Udine", region: "Friuli-Venezia Giulia" },
  // Liguria
  { code: "GE", name: "Genova", region: "Liguria" },
  { code: "IM", name: "Imperia", region: "Liguria" },
  { code: "SP", name: "La Spezia", region: "Liguria" },
  { code: "SV", name: "Savona", region: "Liguria" },
  // Trentino-Alto Adige
  { code: "BZ", name: "Bolzano", region: "Trentino-Alto Adige" },
  { code: "TN", name: "Trento", region: "Trentino-Alto Adige" },
  // Valle d'Aosta
  { code: "AO", name: "Aosta", region: "Valle d'Aosta" },
] as const;

// ==========================================
// Category Icons (Lucide icon names)
// ==========================================

export const CATEGORY_ICONS: Record<string, string> = {
  "food-fresco": "Salad",
  "food-secco": "Package",
  bevande: "Wine",
  surgelati: "Snowflake",
  packaging: "Box",
  cleaning: "SprayBottle",
  attrezzature: "Wrench",
};

// ==========================================
// Order Status Labels
// ==========================================

export const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: "Bozza",
  submitted: "Inviato",
  confirmed: "Confermato",
  preparing: "In preparazione",
  shipping: "In spedizione",
  delivered: "Consegnato",
  cancelled: "Annullato",
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  draft: "text-sage",
  submitted: "text-terracotta",
  confirmed: "text-forest",
  preparing: "text-terracotta",
  shipping: "text-forest-dark",
  delivered: "text-forest",
  cancelled: "text-red-500",
};
