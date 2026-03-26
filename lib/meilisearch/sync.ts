import { meilisearch, PRODUCTS_INDEX } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";

export async function syncProductsToMeilisearch() {
  const supabase = createAdminClient();

  const { data: products, error } = await supabase
    .from("products")
    .select(`
      id, name, description, brand, sku, unit, price,
      min_quantity, image_url, certifications, origin,
      is_available, is_featured, category_id, subcategory_id, supplier_id,
      suppliers!inner(id, company_name, city, rating_avg, is_verified),
      categories!inner(name, slug),
      subcategories(name, slug)
    `)
    .eq("is_available", true)
    .returns<Array<{
      id: string; name: string; description: string | null; brand: string | null;
      unit: string; price: number; image_url: string | null;
      certifications: string[] | null; origin: string | null;
      is_featured: boolean; category_id: string; subcategory_id: string | null;
      supplier_id: string;
      suppliers: { id: string; company_name: string; city: string | null; rating_avg: number; is_verified: boolean };
      categories: { name: string; slug: string };
      subcategories: { name: string; slug: string } | null;
    }>>();

  if (error) throw error;

  const documents = (products ?? []).map((p) => {
    const supplier = p.suppliers;
    const category = p.categories;
    const subcategory = p.subcategories;

    return {
      id: p.id,
      name: p.name,
      description: p.description,
      brand: p.brand,
      unit: p.unit,
      price: p.price,
      image_url: p.image_url,
      certifications: p.certifications,
      origin: p.origin,
      is_featured: p.is_featured,
      category_id: p.category_id,
      category_name: category.name,
      category_slug: category.slug,
      subcategory_id: p.subcategory_id,
      subcategory_name: subcategory?.name ?? null,
      supplier_id: supplier.id,
      supplier_name: supplier.company_name,
      supplier_city: supplier.city,
      supplier_rating: supplier.rating_avg,
      supplier_verified: supplier.is_verified,
    };
  });

  const index = meilisearch.index(PRODUCTS_INDEX);
  await index.addDocuments(documents);
  return documents.length;
}

export async function setupMeilisearchIndex() {
  const index = meilisearch.index(PRODUCTS_INDEX);

  await index.updateFilterableAttributes([
    "category_id", "subcategory_id", "supplier_id",
    "unit", "certifications", "supplier_verified",
    "is_featured", "price",
  ]);

  await index.updateSortableAttributes([
    "price", "supplier_rating", "name",
  ]);

  await index.updateSearchableAttributes([
    "name", "brand", "description", "category_name",
    "subcategory_name", "supplier_name", "origin",
    "certifications",
  ]);
}
