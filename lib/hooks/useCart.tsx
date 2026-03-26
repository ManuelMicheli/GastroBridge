"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { CartItem, CartBySupplier } from "@/types/orders";

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getCartBySupplier: () => CartBySupplier[];
  totalItems: number;
  totalAmount: number;
}

const CartContext = createContext<CartContextType | null>(null);

const CART_KEY = "gastrobridge_cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_KEY);
      if (stored) setItems(JSON.parse(stored));
    } catch {}
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

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
    }}>
      {children}
    </CartContext>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
