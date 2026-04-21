import { cache } from "react";
import { createClient } from "./server";

export const getCachedUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getCachedProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("company_name")
    .eq("id", userId)
    .single<{ company_name: string }>();
  return data;
});
