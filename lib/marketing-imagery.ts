/**
 * Curated Unsplash photo IDs. Stable, horeca-relevant, premium quality.
 */
export const MARKETING_IMAGERY = {
  heroRestaurant: {
    src: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=2400&q=85",
    alt: "Chef cucina al passo, mani che impiattano",
    position: "center 35%",
  },
  closerAmbient: {
    src: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=2880&q=88",
    alt: "Sala ristorante in luce serale",
    position: "center 55%",
  },
} as const;

export type MarketingImageKey = keyof typeof MARKETING_IMAGERY;
