export type RestaurantRow = {
  id: string;
  profile_id: string;
  name: string;
  cuisine: string | null;
  covers: number | null;
  address: string | null;
  city: string | null;
  province: string | null;
  zip_code: string | null;
  phone: string | null;
  email: string | null;
  is_primary: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};
