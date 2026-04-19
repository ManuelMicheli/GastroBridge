import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ReviewCard } from "@/components/reviews/review-card";
import { Card } from "@/components/ui/card";
import { Star } from "lucide-react";
import { LargeTitle } from "@/components/ui/large-title";

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
      {/* Mobile hero */}
      <div className="lg:hidden">
        <LargeTitle
          eyebrow={
            supplier
              ? `${supplier.rating_count} recensioni ricevute`
              : "Feedback clienti"
          }
          title="Recensioni"
          subtitle={
            supplier && supplier.rating_count > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="font-serif text-[18px] font-medium text-[color:var(--color-brand-primary)]"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  {supplier.rating_avg.toFixed(1)}
                </span>
                <span className="inline-flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3 w-3 ${
                        i < Math.round(supplier.rating_avg)
                          ? "fill-[color:var(--color-brand-primary)] text-[color:var(--color-brand-primary)]"
                          : "text-[color:var(--ios-chev-muted)]"
                      }`}
                    />
                  ))}
                </span>
              </span>
            ) : (
              "Nessuna recensione ancora"
            )
          }
        />
      </div>

      {/* Desktop h1 + rating hero */}
      <div className="hidden lg:block">
        <h1 className="font-display text-3xl text-text-primary mb-6">
          Recensioni<span className="text-brand-primary">.</span>
        </h1>

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
      </div>

      {(reviews ?? []).length > 0 ? (
        <div className="space-y-3 lg:space-y-4 px-3 lg:px-0 mt-3 lg:mt-0">
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
        <div className="px-3 lg:px-0 mt-3 lg:mt-0">
          <Card className="text-center py-16">
            <p className="text-sage">Nessuna recensione ricevuta ancora.</p>
          </Card>
        </div>
      )}
    </div>
  );
}
