import { MessageCircle } from "lucide-react";

export function MessagesEmptyState() {
  return (
    <section className="flex-1 flex items-center justify-center bg-cream">
      <div className="max-w-sm text-center px-8">
        <div className="mx-auto h-14 w-14 rounded-full bg-forest-light/50 flex items-center justify-center mb-4">
          <MessageCircle className="h-6 w-6 text-forest" />
        </div>
        <h1 className="font-display text-2xl text-charcoal">Scegli una conversazione</h1>
        <p className="mt-2 text-sm text-sage leading-relaxed">
          Ogni conversazione è legata a una partnership attiva. Nel pannello laterale trovi
          ordini aperti, recenti e prodotti più acquistati con quel fornitore.
        </p>
      </div>
    </section>
  );
}
