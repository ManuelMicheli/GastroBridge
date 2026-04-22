import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ReviewCard } from "@/components/reviews/review-card";
import { Star } from "lucide-react";
import { LargeTitle } from "@/components/ui/large-title";
import { SectionFrame } from "@/components/dashboard/supplier/_awwwards/section-frame";

export const metadata: Metadata = { title: "Recensioni" };

export default async function SupplierReviewsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, rating_avg, rating_count")
    .eq("profile_id", user?.id ?? "")
    .single<{
      id: string;
      rating_avg: number;
      rating_count: number;
    }>();

  type ReviewRow = {
    id: string;
    rating: number;
    quality_rating: number | null;
    delivery_rating: number | null;
    service_rating: number | null;
    comment: string | null;
    supplier_reply: string | null;
    created_at: string;
    restaurants: { name: string } | null;
  };
  const { data: reviews } = await supabase
    .from("reviews")
    .select("*, restaurants(name)")
    .eq("supplier_id", supplier?.id ?? "none")
    .order("created_at", { ascending: false })
    .returns<ReviewRow[]>();

  const list = reviews ?? [];
  const avg = supplier?.rating_avg ?? 0;
  const count = supplier?.rating_count ?? 0;

  return (
    <>
      {/* Mobile */}
      <div className="lg:hidden">
        <LargeTitle
          eyebrow={
            count > 0 ? `${count} recensioni ricevute` : "Feedback clienti"
          }
          title="Recensioni"
          subtitle={
            count > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="font-serif text-[18px] font-medium text-[color:var(--color-brand-primary)]"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  {avg.toFixed(1)}
                </span>
                <span className="inline-flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3 w-3 ${
                        i < Math.round(avg)
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
        {list.length > 0 ? (
          <div className="space-y-3 px-3 mt-3">
            {list.map((review) => {
              const restaurant = review.restaurants as unknown as {
                name: string;
              } | null;
              return (
                <ReviewCard
                  key={review.id}
                  review={{ ...review, restaurant_name: restaurant?.name }}
                />
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Desktop — terminal review log */}
      <div className="hidden lg:block">
        <div className="flex flex-col gap-6">
          <header>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
                Recensioni · feedback clienti · rating aggregato
              </span>
              <span aria-hidden className="h-px flex-1 bg-border-subtle" />
              <span className="inline-flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
                <span className="tabular-nums text-text-primary">{count}</span>
                <span>totali</span>
              </span>
            </div>
            <h1
              className="mt-4 font-display"
              style={{
                fontSize: "var(--text-display-lg)",
                lineHeight: "var(--text-display-lg--line-height)",
                letterSpacing: "var(--text-display-lg--letter-spacing)",
                fontWeight: "var(--text-display-lg--font-weight)",
                color: "var(--color-text-primary)",
              }}
            >
              Recensioni
            </h1>
            <p className="mt-1.5 text-sm text-text-secondary">
              Ogni recensione è un segnale sulla qualità del servizio. Rispondi
              alle critiche per mostrare proattività.
            </p>
          </header>

          {count > 0 && (
            <SectionFrame
              label="Rating · aggregato"
              trailing={`${count} voti`}
              padded={false}
            >
              <div className="flex flex-wrap items-center gap-6 px-5 py-5">
                <div className="flex items-baseline gap-2">
                  <span
                    className="font-mono tabular-nums text-text-primary"
                    style={{
                      fontSize: "48px",
                      lineHeight: 1,
                      letterSpacing: "-0.02em",
                      fontWeight: 500,
                    }}
                  >
                    {avg.toFixed(1)}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-tertiary">
                    / 5.0
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${
                        i < Math.round(avg)
                          ? "fill-accent-amber text-accent-amber"
                          : "text-border-subtle"
                      }`}
                    />
                  ))}
                </div>
                <span aria-hidden className="h-6 w-px bg-border-subtle" />
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-tertiary">
                  {count} {count === 1 ? "recensione" : "recensioni"} ·
                  aggiornato in tempo reale
                </span>
              </div>
            </SectionFrame>
          )}

          <SectionFrame
            label={`Feed · recensioni ricevute · ${list.length}`}
            trailing={list.length > 0 ? "più recenti in alto" : undefined}
            padded={false}
          >
            {list.length === 0 ? (
              <p className="px-4 py-12 text-center font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
                Nessuna recensione ricevuta ancora
              </p>
            ) : (
              <div className="flex flex-col gap-3 p-4">
                {list.map((review) => {
                  const restaurant = review.restaurants as unknown as {
                    name: string;
                  } | null;
                  return (
                    <ReviewCard
                      key={review.id}
                      review={{
                        ...review,
                        restaurant_name: restaurant?.name,
                      }}
                    />
                  );
                })}
              </div>
            )}
          </SectionFrame>
        </div>
      </div>
    </>
  );
}
