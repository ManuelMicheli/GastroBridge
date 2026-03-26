import type { Database } from "./database";

export type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
export type RestaurantInsert =
  Database["public"]["Tables"]["restaurants"]["Insert"];
export type RestaurantUpdate =
  Database["public"]["Tables"]["restaurants"]["Update"];

export type RestaurantWithProfile = Restaurant & {
  profile: {
    company_name: string;
    phone: string | null;
    avatar_url: string | null;
  };
};
