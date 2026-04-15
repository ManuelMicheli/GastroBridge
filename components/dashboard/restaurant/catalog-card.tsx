import Link from "next/link";
import { Package } from "lucide-react";

type Props = {
  id: string;
  supplierName: string;
  itemCount: number;
  updatedAt: string;
};

export function CatalogCard({ id, supplierName, itemCount, updatedAt }: Props) {
  return (
    <Link
      href={`/cataloghi/${id}`}
      className="block rounded-xl bg-surface-card border border-border-subtle p-5 hover:border-accent-green/40 transition-colors"
    >
      <div className="flex items-start justify-between">
        <h3 className="text-base font-semibold text-text-primary truncate">{supplierName}</h3>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
        <span className="inline-flex items-center gap-1"><Package className="h-3.5 w-3.5" /> {itemCount} prodotti</span>
      </div>
      <p className="mt-3 text-xs text-text-tertiary">
        Aggiornato {new Date(updatedAt).toLocaleDateString("it-IT")}
      </p>
    </Link>
  );
}
