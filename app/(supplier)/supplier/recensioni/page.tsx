import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ReviewCard } from "@/components/reviews/review-card";
import { Card } from "@/components/ui/card";
import { Star } from "lucide-react";

export const metadata: Metadata = { title: "Recensioni" };

export default async function SupplierReviewsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, rating_avg, rating_count")
    .eq("profile_id", user?.id ?? "")
    .single<{ id: string; rating_avg: number; rating_count: number }>();

  type ReviewRow = { id: string; rating: number; quality_rating: number | null; delivery_rating: number | null; service_rating: number | null; comment: string | null; supplier_reply: string | null; created_at: string; restaurants: { name: string } | null };
  const { data: reviews } = await supabase
    .from("reviews")
    .select("*, restaurants(name)")
    .eq("supplier_id", supplier?.id ?? "none")
    .order("created_at", { ascending: false })
    .returns<ReviewRow[]>();

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal mb-6">Recensioni</h1>

      {supplier && (
        <Card className="mb-6">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-4xl font-mono font-bold text-charcoal">{supplier.rating_avg.toFixed(1)}</p>
              <div className="flex items-center gap-1 mt-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`h-4 w-4 ${i < Math.round(supplier.rating_avg) ? "fill-terracotta text-terracotta" : "text-sage-muted"}`} />
                ))}
              </div>
              <p className="text-xs text-sage mt-1">{supplier.rating_count} recensioni</p>
            </div>
          </div>
        </Card>
      )}

      {(reviews ?? []).length > 0 ? (
        <div className="space-y-4">
          {(reviews ?? []).map((review) => {
            const restaurant = review.restaurants as unknown as { name: string } | null;
            return (
              <ReviewCard
                key={review.id}
                review={{ ...review, restaurant_name: restaurant?.name }}
              />
            );
          })}
        </div>
      ) : (
        <Card className="text-center py-16">
          <p className="text-sage">Nessuna recensione ricevuta ancora.</p>
        </Card>
      )}
    </div>
  );
}
