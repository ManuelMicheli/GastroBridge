import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatUnitShort } from "@/lib/utils/formatters";
import { Plus, Upload } from "lucide-react";
import type { UnitType } from "@/types/database";

export const metadata: Metadata = { title: "Catalogo" };

export default async function CatalogPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("profile_id", user?.id ?? "")
    .single<{ id: string }>();

  const { data: products } = await supabase
    .from("products")
    .select("id, name, brand, unit, price, is_available, is_featured, image_url")
    .eq("supplier_id", supplier?.id ?? "none")
    .order("created_at", { ascending: false })
    .returns<Array<{ id: string; name: string; brand: string | null; unit: string; price: number; is_available: boolean; is_featured: boolean; image_url: string | null }>>();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-charcoal">Catalogo</h1>
        <div className="flex gap-3">
          <Link href="/supplier/catalogo/import">
            <Button variant="secondary" size="sm">
              <Upload className="h-4 w-4" /> Import CSV
            </Button>
          </Link>
          <Link href="/supplier/catalogo/nuovo">
            <Button size="sm">
              <Plus className="h-4 w-4" /> Nuovo Prodotto
            </Button>
          </Link>
        </div>
      </div>

      {(products ?? []).length > 0 ? (
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-sage uppercase tracking-wider">
                <th className="px-6 py-3">Prodotto</th>
                <th className="px-6 py-3">Prezzo</th>
                <th className="px-6 py-3">Stato</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(products ?? []).map((p) => (
                <tr key={p.id} className="border-t border-sage-muted/20 hover:bg-gray-50/50">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-charcoal">{p.name}</p>
                    {p.brand && <p className="text-xs text-sage">{p.brand}</p>}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono font-bold text-forest">
                      {formatCurrency(p.price)}/{formatUnitShort(p.unit as UnitType)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={p.is_available ? "success" : "default"}>
                      {p.is_available ? "Attivo" : "Disattivato"}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/supplier/catalogo/${p.id}`}>
                      <Button variant="ghost" size="sm">Modifica</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Card className="text-center py-16">
          <p className="text-sage mb-4">Nessun prodotto nel catalogo.</p>
          <Link href="/supplier/catalogo/nuovo">
            <Button><Plus className="h-4 w-4" /> Aggiungi il primo prodotto</Button>
          </Link>
        </Card>
      )}
    </div>
  );
}
