export type RelationshipStatus =
  | "pending"
  | "active"
  | "paused"
  | "rejected"
  | "archived";

export type RestaurantSupplierRow = {
  id: string;
  restaurant_id: string;
  supplier_id: string;
  status: RelationshipStatus;
  invited_by: string;
  invited_at: string;
  responded_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type RelationshipWithSupplier = RestaurantSupplierRow & {
  supplier: {
    id: string;
    company_name: string;
    logo_url: string | null;
    city: string | null;
    is_verified: boolean;
    rating_avg: number | null;
  } | null;
};

export type RelationshipWithRestaurant = RestaurantSupplierRow & {
  restaurant: {
    id: string;
    name: string;
    city: string | null;
    cuisine: string | null;
  } | null;
};

export type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };
