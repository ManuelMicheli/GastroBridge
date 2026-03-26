import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ProductDetailClient } from "./product-detail-client";

export const metadata: Metadata = { title: "Confronta Prezzi" };

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const supabase = await createClient();

  // Get all products with the same name for price comparison
  const { data: product } = await supabase
    .from("products")
    .select("name, unit, category_id")
    .eq("id", productId)
    .single<{ name: string; unit: string; category_id: string }>();

  if (!product) notFound();

  // Find all suppliers offering this product (same name/category)
  const { data: comparisons } = await supabase
    .from("products")
    .select(`
      id, name, price, min_quantity, unit, certifications, is_available,
      suppliers!inner(id, company_name, rating_avg, rating_count, is_verified, city, min_order_amount)
    `)
    .eq("category_id", product.category_id)
    .ilike("name", product.name)
    .eq("is_available", true);

  return (
    <ProductDetailClient
      productName={product.name}
      unit={product.unit}
      comparisons={comparisons ?? []}
    />
  );
}
