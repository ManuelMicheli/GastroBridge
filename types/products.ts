import type { Database, UnitType } from "./database";

export type Product = Database["public"]["Tables"]["products"]["Row"];
export type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
export type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];

export type ProductWithSupplier = Product & {
  supplier: {
    id: string;
    company_name: string;
    rating_avg: number;
    rating_count: number;
    is_verified: boolean;
    min_order_amount: number | null;
    city: string | null;
    delivery_days: Record<string, unknown> | null;
  };
};

export type ProductSearchResult = {
  id: string;
  name: string;
  brand: string | null;
  description: string | null;
  category_id: string;
  subcategory_id: string | null;
  unit: UnitType;
  price: number;
  supplier_id: string;
  supplier_name: string;
  certifications: string[] | null;
  origin: string | null;
  image_url: string | null;
};

export type PriceCompareRow = {
  product: Product;
  supplier: {
    id: string;
    company_name: string;
    rating_avg: number;
    rating_count: number;
    is_verified: boolean;
    city: string | null;
    min_order_amount: number | null;
  };
  deliveryInfo: {
    canDeliverTomorrow: boolean;
    deliveryFee: number;
    freeDeliveryAbove: number | null;
  };
  badges: ProductBadge[];
};

export type ProductBadge =
  | "miglior-prezzo"
  | "piu-venduto"
  | "nuovo"
  | "consegna-domani"
  | "bio"
  | "dop"
  | "igp"
  | "km0";
