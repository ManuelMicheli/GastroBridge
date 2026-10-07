"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { CartItem, CartBySupplier } from "@/types/orders";
import { scopedStorageKey, TYPICAL_ORDER_BASE_KEY } from "./user-storage";

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getCartBySupplier: () => CartBySupplier[];
  totalItems: number;
  totalAmount: number;
  /** localStorage key of the per-account "ordine tipico" (null when anonymous). */
  typicalOrderKey: string | null;
}

const CartContext = createContext<CartContextType | null>(null);

// Pre-scoping key, shared by every account on the browser. Migrated once to
// the first user that loads the app, then removed.
const LEGACY_CART_KEY = "gastrobridge_cart";

function cartKey(userId: string): string {
  return `${LEGACY_CART_KEY}:${userId}`;
}

export function CartProvider({
  children,
  userId,
}: {
  children: ReactNode;
  /** Scopes the persisted cart per account (no persistence when empty). */
  userId?: string;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const key = userId ? cartKey(userId) : null;
  // Key whose contents are currently loaded in `items` (set in the same
  // render as the items): never write one account's cart under another
  // account's key, nor the empty initial state over a stored cart.
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);

  // Load from localStorage
  useEffect(() => {
    if (!key) {
      setItems([]);
      setHydratedKey(null);
      return;
    }
    try {
      let stored = localStorage.getItem(key);
      const legacy = localStorage.getItem(LEGACY_CART_KEY);
      if (legacy !== null) {
        if (stored === null) {
          stored = legacy;
          localStorage.setItem(key, legacy);
        }
        localStorage.removeItem(LEGACY_CART_KEY);
      }
      setItems(stored ? JSON.parse(stored) : []);
    } catch {
      setItems([]);
    }
    setHydratedKey(key);
  }, [key]);

  // Save to localStorage
  useEffect(() => {
    if (!key || hydratedKey !== key) return;
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch {}
  }, [items, key, hydratedKey]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === item.productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === item.productId
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
      }
      return [...prev, item];
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, quantity } : i))
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const getCartBySupplier = useCallback((): CartBySupplier[] => {
    const grouped = new Map<string, CartItem[]>();
    items.forEach((item) => {
      const existing = grouped.get(item.supplierId) ?? [];
      grouped.set(item.supplierId, [...existing, item]);
    });

    return Array.from(grouped.entries()).map(([supplierId, supplierItems]) => {
      const subtotal = supplierItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
      return {
        supplierId,
        supplierName: supplierItems[0]?.supplierName ?? "",
        minOrderAmount: null,
        items: supplierItems,
        subtotal,
        isBelowMinimum: false,
      };
    });
  }, [items]);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalAmount = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  return (
    <CartContext value={{
      items, addItem, removeItem, updateQuantity, clearCart,
      getCartBySupplier, totalItems, totalAmount,
      typicalOrderKey: scopedStorageKey(TYPICAL_ORDER_BASE_KEY, userId),
    }}>
      {children}
    </CartContext>
  );
}

/** Cart context or null when rendered outside a CartProvider (e.g. supplier shell). */
export function useCartOptional() {
  return useContext(CartContext);
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
