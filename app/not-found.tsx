import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <SearchX className="h-12 w-12 text-sage mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-charcoal mb-2">
          Pagina non trovata
        </h2>
        <p className="text-sage mb-6">
          La pagina che stai cercando non esiste o e stata spostata.
        </p>
        <Link href="/">
          <Button variant="primary">Torna alla Home</Button>
        </Link>
      </div>
    </div>
  );
}
