/**
 * Curated Unsplash photo IDs. Stable, horeca-relevant, premium quality.
 */
export const MARKETING_IMAGERY = {
  heroRestaurant: {
    src: "https://images.unsplash.com/photo-1489450278009-822e9be04dff?auto=format&fit=crop&w=2400&q=85",
    alt: "Banco fornitore con prodotti freschi: verdure e ortaggi di stagione",
    position: "center 50%",
  },
  closerAmbient: {
    src: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=2880&q=88",
    alt: "Sala ristorante in luce serale",
    position: "center 55%",
  },
} as const;

export type MarketingImageKey = keyof typeof MARKETING_IMAGERY;
