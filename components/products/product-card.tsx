import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatUnitShort } from "@/lib/utils/formatters";
import { Star, Shield } from "lucide-react";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    brand: string | null;
    unit: string;
    price: number;
    image_url: string | null;
    category_name: string;
    supplier_name: string;
    supplier_rating: number;
    supplier_verified: boolean;
    certifications: string[] | null;
  };
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link href={`/cerca/${product.id}`}>
      <Card className="hover:shadow-elevated transition-shadow cursor-pointer h-full">
        {/* Image placeholder */}
        <div className="w-full h-40 bg-sage-muted/20 rounded-xl mb-4 flex items-center justify-center">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover rounded-xl"
            />
          ) : (
            <span className="text-4xl">📦</span>
          )}
        </div>

        <div className="flex flex-wrap gap-1 mb-2">
          <Badge variant="info">{product.category_name}</Badge>
          {product.certifications?.includes("BIO") && (
            <Badge variant="success">BIO</Badge>
          )}
        </div>

        <h3 className="font-bold text-charcoal mb-1 line-clamp-2">{product.name}</h3>
        {product.brand && (
          <p className="text-xs text-sage mb-2">{product.brand}</p>
        )}

        <div className="flex items-baseline gap-1 mb-3">
          <span className="text-xl font-mono font-bold text-forest">
            {formatCurrency(product.price)}
          </span>
          <span className="text-sm text-sage">/{formatUnitShort(product.unit as Parameters<typeof formatUnitShort>[0])}</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-sage">
          <span className="truncate">{product.supplier_name}</span>
          {product.supplier_verified && <Shield className="h-3.5 w-3.5 text-forest shrink-0" />}
          <div className="flex items-center gap-0.5 ml-auto shrink-0">
            <Star className="h-3.5 w-3.5 fill-terracotta text-terracotta" />
            <span>{product.supplier_rating.toFixed(1)}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
