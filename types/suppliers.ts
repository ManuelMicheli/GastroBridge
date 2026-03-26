import type { Database } from "./database";
import type { Product } from "./products";

export type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];
export type SupplierInsert = Database["public"]["Tables"]["suppliers"]["Insert"];
export type SupplierUpdate = Database["public"]["Tables"]["suppliers"]["Update"];

export type SupplierWithProducts = Supplier & {
  products: Product[];
  productCount: number;
};

export type DeliveryZone = Database["public"]["Tables"]["delivery_zones"]["Row"];
export type DeliveryZoneInsert =
  Database["public"]["Tables"]["delivery_zones"]["Insert"];
