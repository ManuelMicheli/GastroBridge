import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// No public landing: the root sends signed-in users to their area and
// everyone else to the login page.
export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  redirect(profile?.role === "supplier" ? "/supplier/dashboard" : "/dashboard");
}
