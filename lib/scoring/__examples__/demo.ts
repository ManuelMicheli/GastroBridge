/**
 * Ad-hoc demo for the scoring engine.
 *
 * Run with: `npx tsx lib/scoring/__examples__/demo.ts`
 *
 * Each case prints preferences, offers, and the resulting ranking +
 * exclusions so the behaviour can be eyeballed.
 */

import { rankOffers } from "../rank";
import type {
  CategoryMacro,
  Offer,
  Preferences,
  ScoredOffer,
} from "../types";

function makeOffer(partial: Partial<Offer> & { id: string }): Offer {
  return {
    id: partial.id,
    supplierId: partial.supplierId ?? `sup-${partial.id}`,
    productName: partial.productName ?? "generic",
    unit: partial.unit ?? "kg",
    price: partial.price ?? 10,
    qualityTier: partial.qualityTier ?? "standard",
    isBio: partial.isBio ?? false,
    leadTimeDays: partial.leadTimeDays ?? 2,
    certifications: partial.certifications ?? [],
    macroCategory: partial.macroCategory ?? "secco",
    originCountry: partial.originCountry,
    supplierMinOrder: partial.supplierMinOrder,
    supplierRating: partial.supplierRating,
    supplierDeliveryDays: partial.supplierDeliveryDays,
    supplierBlocked: partial.supplierBlocked,
  };
}

function basePrefs(overrides: Partial<Preferences["global"]> = {}): Preferences {
  return {
    global: {
      requiredCertifications: [],
      blockedSupplierIds: [],
      priceWeight: 50,
      qualityWeight: 30,
      deliveryWeight: 20,
      preferBio: false,
      preferKm0: false,
      ...overrides,
    },
    byCategory: {},
  };
}

function fmtScored(s: ScoredOffer): string {
  const b = s.breakdown;
  return (
    `  [${s.offer.id}] score=${s.score.toFixed(1)} ` +
    `price=${s.offer.price} tier=${s.offer.qualityTier} ` +
    `lead=${s.offer.leadTimeDays}d bio=${s.offer.isBio} ` +
    `origin=${s.offer.originCountry ?? "?"} | ` +
    `normP=${b.price.toFixed(0)} normQ=${b.quality} normD=${b.delivery} ` +
    `+bio=${b.bioBonus} +km0=${b.km0Bonus} ` +
    `w=(${b.weights.price.toFixed(2)},${b.weights.quality.toFixed(2)},${b.weights.delivery.toFixed(2)})`
  );
}

function printCase(title: string, offers: Offer[], prefs: Preferences): void {
  console.log(`\n=== ${title} ===`);
  console.log("Offers:");
  for (const o of offers) {
    console.log(
      `  [${o.id}] price=${o.price} tier=${o.qualityTier} lead=${o.leadTimeDays}d ` +
        `bio=${o.isBio} certs=[${o.certifications.join(",")}] cat=${o.macroCategory} ` +
        `origin=${o.originCountry ?? "?"} minOrder=${o.supplierMinOrder ?? "-"}`,
    );
  }
  const result = rankOffers(offers, prefs);
  console.log(`Included (${result.included.length}):`);
  for (const s of result.included) console.log(fmtScored(s));
  if (result.excluded.length > 0) {
    console.log(`Excluded (${result.excluded.length}):`);
    for (const e of result.excluded) {
      console.log(`  [${e.offer.id}] reasons:`, JSON.stringify(e.reasons));
    }
  }
  console.log(`Average price (included): ${result.averagePrice.toFixed(2)}`);
}

Promise.resolve().then(() => {
  // ---------- Case 1: same product, 3 prices → cheapest wins ----------
  printCase(
    "1. Same product, different prices — cheapest wins (price-heavy weights)",
    [
      makeOffer({ id: "A", price: 8 }),
      makeOffer({ id: "B", price: 10 }),
      makeOffer({ id: "C", price: 14 }),
    ],
    basePrefs({ priceWeight: 80, qualityWeight: 10, deliveryWeight: 10 }),
  );

  // ---------- Case 2: same price, different quality → premium wins ----------
  printCase(
    "2. Same price, different tiers — quality-weight dominant => premium wins",
    [
      makeOffer({ id: "Eco", price: 10, qualityTier: "economy" }),
      makeOffer({ id: "Std", price: 10, qualityTier: "standard" }),
      makeOffer({ id: "Prem", price: 10, qualityTier: "premium" }),
    ],
    basePrefs({ priceWeight: 10, qualityWeight: 80, deliveryWeight: 10 }),
  );

  // ---------- Case 3: supplier_min_order exceeds ceiling → excluded ----------
  printCase(
    "3. One offer has supplier_min_order above ristoratore ceiling — excluded",
    [
      makeOffer({ id: "Ok", price: 10, supplierMinOrder: 150 }),
      makeOffer({ id: "Pricey", price: 9, supplierMinOrder: 800 }),
    ],
    basePrefs({ minOrderMaxEur: 300 }),
  );

  // ---------- Case 4: required DOP cert missing → excluded ----------
  printCase(
    "4. Required certification DOP — one offer lacks it => excluded",
    [
      makeOffer({ id: "WithDOP", price: 12, certifications: ["DOP"] }),
      makeOffer({ id: "NoDOP", price: 9, certifications: [] }),
    ],
    basePrefs({ requiredCertifications: ["DOP"] }),
  );

  // ---------- Case 5: preferBio bumps bio offer ----------
  printCase(
    "5. preferBio=true — bio offer gets +10 bonus bump (visible in breakdown)",
    [
      makeOffer({ id: "NonBio", price: 10, isBio: false }),
      makeOffer({ id: "Bio", price: 10, isBio: true }),
    ],
    basePrefs({
      priceWeight: 50,
      qualityWeight: 30,
      deliveryWeight: 20,
      preferBio: true,
    }),
  );

  // ---------- Case 6: category override min_quality_tier=premium for pesce ----------
  const prefs6: Preferences = {
    ...basePrefs(),
    byCategory: {
      pesce: { minQualityTier: "premium" as const },
    },
  };
  const pesceCat: CategoryMacro = "pesce";
  printCase(
    "6. Category override — pesce requires premium; economy fish excluded",
    [
      makeOffer({
        id: "EcoFish",
        price: 6,
        qualityTier: "economy",
        macroCategory: pesceCat,
      }),
      makeOffer({
        id: "PremFish",
        price: 12,
        qualityTier: "premium",
        macroCategory: pesceCat,
      }),
      makeOffer({
        id: "EcoBread",
        price: 3,
        qualityTier: "economy",
        macroCategory: "panetteria",
      }),
    ],
    prefs6,
  );

  console.log("\nDemo complete.");
});
