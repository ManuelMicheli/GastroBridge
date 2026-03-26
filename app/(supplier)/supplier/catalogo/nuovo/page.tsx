"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const UNIT_OPTIONS = [
  { value: "kg", label: "Chilogrammo (kg)" },
  { value: "g", label: "Grammo (g)" },
  { value: "lt", label: "Litro (lt)" },
  { value: "ml", label: "Millilitro (ml)" },
  { value: "pz", label: "Pezzo (pz)" },
  { value: "cartone", label: "Cartone" },
  { value: "bottiglia", label: "Bottiglia" },
  { value: "latta", label: "Latta" },
  { value: "confezione", label: "Confezione" },
];

export default function NewProductPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    const form = new FormData(e.currentTarget);
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    const { data: supplier } = await supabase
      .from("suppliers")
      .select("id")
      .eq("profile_id", user?.id ?? "")
      .single<{ id: string }>();

    if (!supplier) {
      toast("Errore: profilo fornitore non trovato");
      setIsLoading(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("products") as any).insert({
      supplier_id: supplier.id,
      name: form.get("name") as string,
      brand: (form.get("brand") as string) || null,
      description: (form.get("description") as string) || null,
      unit: form.get("unit") as string,
      price: parseFloat(form.get("price") as string),
      min_quantity: parseFloat(form.get("min_quantity") as string) || 1,
      origin: (form.get("origin") as string) || null,
      category_id: form.get("category_id") as string || "c1000000-0000-0000-0000-000000000001",
    });

    if (error) {
      toast("Errore nel salvataggio: " + error.message);
    } else {
      toast("Prodotto aggiunto con successo!");
      router.push("/supplier/catalogo");
    }
    setIsLoading(false);
  }

  return (
    <div>
      <Link href="/supplier/catalogo" className="flex items-center gap-2 text-sage hover:text-charcoal mb-4 text-sm">
        <ArrowLeft className="h-4 w-4" /> Torna al catalogo
      </Link>
      <h1 className="text-2xl font-bold text-charcoal mb-6">Nuovo Prodotto</h1>
      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input name="name" label="Nome Prodotto" placeholder="Es. Pomodori Pelati San Marzano" required />
          <Input name="brand" label="Brand" placeholder="Es. Mutti" />
          <div className="grid grid-cols-2 gap-4">
            <Select name="unit" label="Unita di misura" options={UNIT_OPTIONS} />
            <Input name="price" label="Prezzo (€)" type="number" step="0.01" min="0" required placeholder="0.00" />
          </div>
          <Input name="min_quantity" label="Quantita minima" type="number" step="0.5" min="0.5" defaultValue="1" />
          <Input name="origin" label="Origine" placeholder="Es. Italia, Campania" />
          <Input name="description" label="Descrizione" placeholder="Descrizione del prodotto..." />
          <div className="flex gap-3 pt-2">
            <Button type="submit" isLoading={isLoading}>Salva Prodotto</Button>
            <Link href="/supplier/catalogo">
              <Button variant="secondary" type="button">Annulla</Button>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
