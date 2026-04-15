import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listSalesUnitsForProduct } from "@/lib/supplier/catalog/actions";
import ProductDetailTabs from "@/components/supplier/catalog/product-detail-tabs";
import ProductGeneralForm from "@/components/supplier/catalog/product-general-form";
import SalesUnitsEditor from "@/components/supplier/catalog/sales-units-editor";
import type { Database } from "@/types/database";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle<ProductRow>();

  if (!product) notFound();

  // Warehouses for the same supplier (for the default_warehouse_id dropdown).
  const { data: warehousesRaw } = await supabase
    .from("warehouses")
    .select("id, name, is_active")
    .eq("supplier_id", product.supplier_id)
    .eq("is_active", true)
    .order("name", { ascending: true })
    .returns<Array<{ id: string; name: string; is_active: boolean }>>();
  const warehouses = (warehousesRaw ?? []).map((w) => ({
    id: w.id,
    name: w.name,
  }));

  const salesUnitsRes = await listSalesUnitsForProduct(id);
  const salesUnits = salesUnitsRes.ok ? salesUnitsRes.data : [];

  return (
    <div>
      <Link
        href="/supplier/catalogo"
        className="flex items-center gap-2 text-sage hover:text-charcoal mb-4 text-sm"
      >
        <ArrowLeft className="h-4 w-4" /> Torna al catalogo
      </Link>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">{product.name}</h1>
          {product.brand && (
            <p className="text-sm text-sage">{product.brand}</p>
          )}
        </div>
      </div>

      <ProductDetailTabs
        tabs={[
          {
            key: "generali",
            label: "Generali",
            content: (
              <ProductGeneralForm
                productId={product.id}
                initial={{
                  name: product.name,
                  description: product.description,
                  brand: product.brand,
                  sku: product.sku,
                  price: product.price,
                  is_available: product.is_available,
                  lead_time_days: product.lead_time_days,
                  default_warehouse_id: product.default_warehouse_id,
                  hazard_class: product.hazard_class,
                  tax_rate: product.tax_rate,
                }}
                warehouses={warehouses}
              />
            ),
          },
          {
            key: "sales_units",
            label: "Unità di vendita",
            content: (
              <SalesUnitsEditor
                productId={product.id}
                initialUnits={salesUnits}
                productPrice={product.price}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
