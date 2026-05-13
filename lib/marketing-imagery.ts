/**
 * Curated Unsplash photo IDs. Stable, horeca-relevant, premium quality.
 */
export const MARKETING_IMAGERY = {
  heroRestaurant: {
    src: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=2400&q=85",
    alt: "Chef cucina al passo, mani che impiattano",
    position: "center 35%",
  },
  heroSupplier: {
    src: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=2400&q=85",
    alt: "Cassette di prodotti freschi al mercato all'ingrosso",
    position: "center 40%",
  },
  interludeWide: {
    src: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=2880&q=88",
    alt: "Pasta artigianale stesa sul piano in marmo",
    position: "center 55%",
  },
  atelierKitchen: {
    src: "https://images.unsplash.com/photo-1577106263724-2c8e03bfe9cf?auto=format&fit=crop&w=1600&q=85",
    alt: "Chef compone un piatto con erbe fresche",
    position: "center 40%",
  },
  atelierMarket: {
    src: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1600&q=85",
    alt: "Banco mercato con ortaggi appena raccolti",
    position: "center 50%",
  },
  atelierCellar: {
    src: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=1600&q=85",
    alt: "Bottiglie e taglieri in cantina d'autore",
    position: "center 50%",
  },
  closerAmbient: {
    src: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=2880&q=88",
    alt: "Sala ristorante in luce serale",
    position: "center 55%",
  },
} as const;

export type MarketingImageKey = keyof typeof MARKETING_IMAGERY;
