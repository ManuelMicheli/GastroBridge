"use client";

import { PriceCompareTable } from "@/components/products/price-compare-table";
import { toast } from "@/components/ui/toast";
import { useCart } from "@/lib/hooks/useCart";
import type { UnitType } from "@/types/database";
import type { PriceCompareRow } from "@/types/products";

interface ProductDetailClientProps {
  productName: string;
  unit: string;
  comparisons: Array<{
    id: string;
    name: string;
    price: number;
    min_quantity: number;
    unit: string;
    certifications: string[] | null;
    is_available: boolean;
    lead_time_days?: number | null;
    suppliers: unknown;
  }>;
}

export function ProductDetailClient({
  productName,
  unit,
  comparisons,
}: ProductDetailClientProps) {
  const { addItem } = useCart();
  // Rows arrive sorted by price; still compute the min so the badge is right
  // regardless of ordering.
  const minPrice = comparisons.length
    ? Math.min(...comparisons.map((c) => c.price))
    : null;

  const rows: PriceCompareRow[] = comparisons.map((c) => {
    const supplier = c.suppliers as {
      id: string; company_name: string; rating_avg: number;
      rating_count: number; is_verified: boolean; city: string | null;
      min_order_amount: number | null;
    };

    const badges: PriceCompareRow["badges"] = [];
    if (minPrice !== null && c.price === minPrice) badges.push("miglior-prezzo");
    if (c.certifications?.includes("BIO")) badges.push("bio");
    if (c.certifications?.includes("DOP")) badges.push("dop");

    return {
      product: {
        id: c.id,
        supplier_id: supplier.id,
        category_id: "",
        subcategory_id: null,
        name: c.name,
        description: null,
        brand: null,
        sku: null,
        unit: c.unit as UnitType,
        price: c.price,
        min_quantity: c.min_quantity,
        max_quantity: null,
        image_url: null,
        certifications: c.certifications,
        origin: null,
        is_available: c.is_available,
        is_featured: false,
        quality_tier: "standard",
        is_bio: false,
        lead_time_days: c.lead_time_days ?? 1,
        packaging_size: null,
        packaging_unit: null,
        certifications_structured: [],
        cold_chain_required: false,
        origin_country: null,
        origin_region: null,
        macro_category: "altro",
        default_warehouse_id: null,
        hazard_class: null,
        tax_rate: 0,
        created_at: "",
        updated_at: "",
      },
      supplier: {
        id: supplier.id,
        company_name: supplier.company_name,
        rating_avg: supplier.rating_avg,
        rating_count: supplier.rating_count,
        is_verified: supplier.is_verified,
        city: supplier.city,
        min_order_amount: supplier.min_order_amount,
      },
      deliveryInfo: {
        canDeliverTomorrow: (c.lead_time_days ?? 1) <= 1,
        deliveryFee: 0,
        freeDeliveryAbove: null,
      },
      badges,
    };
  });

  function handleAddToCart(row: PriceCompareRow, quantity: number) {
    addItem({
      productId: row.product.id,
      supplierId: row.supplier.id,
      supplierName: row.supplier.company_name,
      name: row.product.name,
      brand: row.product.brand,
      unit: row.product.unit,
      unitPrice: row.product.price,
      quantity,
      imageUrl: row.product.image_url,
      minQuantity: row.product.min_quantity,
    });
    toast.success(`${quantity}x ${row.product.name} da ${row.supplier.company_name} aggiunto al carrello`);
  }

  return (
    <div>
      <PriceCompareTable
        rows={rows}
        productName={productName}
        unit={unit as UnitType}
        onAddToCart={handleAddToCart}
      />
    </div>
  );
}
