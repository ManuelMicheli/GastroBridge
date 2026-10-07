import { formatCurrency } from "@/lib/utils/formatters";
import type { CartBySupplier, CartItem } from "@/types/orders";
import { createCatalogOrder } from "@/lib/orders/actions";
import { submitOrder } from "@/lib/orders/submit";

/**
 * Il carrello può contenere due tipi di righe:
 *  - real product: `productId` è un UUID di `products` → submitOrder (RPC
 *    atomica con order_splits / order_split_items).
 *  - catalog item: `productId` ha prefisso `catalog_<id>` (cataloghi importati
 *    da PDF/Excel) → createCatalogOrder (header-only, senza FK su products).
 *
 * Se il carrello mischia i due tipi, inviamo prima l'ordine marketplace e
 * poi l'ordine catalog come fallback.
 */
export function isCatalogItem(productId: string): boolean {
  return productId.startsWith("catalog_");
}

type CheckoutDeps = {
  items: CartItem[];
  supplierGroups: CartBySupplier[];
  restaurantId: string | null;
};

export type CheckoutOutcome =
  | { ok: true; orderIds: string[] }
  | {
      ok: false;
      error: string;
      /**
       * Cart lines already turned into an order before the failure (mixed
       * carts). The caller must drop them from the cart so a retry does not
       * submit them twice.
       */
      submittedProductIds?: string[];
      orderIds?: string[];
    };

/**
 * Run the checkout flow for the current cart. Mirrors the original inline
 * logic bit-for-bit: marketplace items go through `submitOrder`, catalog
 * items (prefixed `catalog_`) go through `createCatalogOrder`; mixed carts
 * call both in sequence and require at least one to succeed.
 */
export async function runCheckout({
  items,
  supplierGroups,
  restaurantId,
}: CheckoutDeps): Promise<CheckoutOutcome> {
  if (items.length === 0) {
    return { ok: false, error: "Carrello vuoto" };
  }

  const realItems    = items.filter((it) => !isCatalogItem(it.productId));
  const catalogItems = items.filter((it) =>  isCatalogItem(it.productId));

  let anyOk = false;
  const orderIds: string[] = [];

  // 1. Marketplace items via submitOrder (RPC atomica).
  if (realItems.length > 0) {
    if (!restaurantId) {
      return { ok: false, error: "Ristorante non trovato" };
    }
    const res = await submitOrder({
      restaurantId,
      items: realItems.map((it) => ({
        productId:  it.productId,
        supplierId: it.supplierId,
        quantity:   it.quantity,
        unitPrice:  it.unitPrice,
      })),
      notes: `Ordine da carrello (${realItems.length} righe)`,
    });
    if (!res.ok) {
      return { ok: false, error: `ordine: ${res.error}` };
    }
    anyOk = true;
    orderIds.push(res.data.orderId);
  }

  // 2. Catalog items via createCatalogOrder (legacy, header-only).
  if (catalogItems.length > 0) {
    const catalogGroups = supplierGroups.filter((g) =>
      g.items.some((it) => isCatalogItem(it.productId)),
    );
    const catalogTotal = catalogItems.reduce(
      (s, it) => s + it.unitPrice * it.quantity,
      0,
    );

    // The catalog order notes list only catalog lines (marketplace lines are
    // already in their own order).
    const summaryLines: string[] = [];
    const groups: { catalogId: string; subtotal: number }[] = [];
    for (const g of catalogGroups) {
      const lines = g.items.filter((it) => isCatalogItem(it.productId));
      const subtotal = lines.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
      groups.push({ catalogId: g.supplierId, subtotal });
      summaryLines.push(`--- ${g.supplierName} (${formatCurrency(subtotal)}) ---`);
      for (const it of lines) {
        summaryLines.push(`  ${it.quantity}× ${it.name} @ ${formatCurrency(it.unitPrice)}`);
      }
    }

    const res = await createCatalogOrder({
      total:         catalogTotal,
      supplierCount: catalogGroups.length,
      itemCount:     catalogItems.length,
      summary:       summaryLines.join("\n"),
      groups,
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `ordine catalogo: ${res.error}`,
        // The marketplace order (if any) is already placed.
        submittedProductIds: realItems.map((it) => it.productId),
        orderIds,
      };
    }
    anyOk = true;
    orderIds.push(res.data.id);
  }

  if (!anyOk) {
    return { ok: false, error: "nessun ordine inviato" };
  }

  return { ok: true, orderIds };
}
