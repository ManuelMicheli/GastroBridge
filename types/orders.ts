import type { Database, UnitType } from "./database";

export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type OrderInsert = Database["public"]["Tables"]["orders"]["Insert"];
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
export type OrderItemInsert =
  Database["public"]["Tables"]["order_items"]["Insert"];
export type OrderSplit = Database["public"]["Tables"]["order_splits"]["Row"];

export type CartItem = {
  productId: string;
  supplierId: string;
  name: string;
  brand: string | null;
  unit: UnitType;
  unitPrice: number;
  quantity: number;
  imageUrl: string | null;
  supplierName: string;
  minQuantity: number;
};

export type CartBySupplier = {
  supplierId: string;
  supplierName: string;
  minOrderAmount: number | null;
  items: CartItem[];
  subtotal: number;
  isBelowMinimum: boolean;
};

export type OrderWithDetails = Order & {
  restaurant: {
    id: string;
    name: string;
  };
  items: (OrderItem & {
    product: {
      name: string;
      unit: UnitType;
      image_url: string | null;
    };
    supplier: {
      company_name: string;
    };
  })[];
  splits: (OrderSplit & {
    supplier: {
      company_name: string;
    };
  })[];
};
