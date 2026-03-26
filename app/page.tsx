import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Search, ShoppingCart, TrendingDown } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-cream">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-cream/80 backdrop-blur-md border-b border-sage-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center">
            <span className="text-xl font-display text-charcoal">Gastro</span>
            <span className="text-xl font-body font-bold text-forest">
              Bridge
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/pricing"
              className="text-sm text-charcoal hover:text-forest transition-colors"
            >
              Prezzi
            </Link>
            <Link
              href="/fornitori"
              className="text-sm text-charcoal hover:text-forest transition-colors"
            >
              Per i Fornitori
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Accedi
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">
                Inizia Gratis
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-forest-light text-forest-dark text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
            <span className="h-2 w-2 bg-forest rounded-full animate-pulse" />
            Marketplace B2B Ho.Re.Ca.
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display text-charcoal leading-tight tracking-tight mb-6">
            Tutti i tuoi fornitori.
            <br />
            <span className="text-forest">Un solo posto.</span>
          </h1>
          <p className="text-lg sm:text-xl text-sage max-w-2xl mx-auto mb-10 leading-relaxed">
            Confronta prezzi, scopri nuovi fornitori e gestisci gli ordini per
            il tuo ristorante da un&apos;unica piattaforma.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="w-full sm:w-auto">
                Inizia Gratis
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                Scopri i Piani
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-display text-charcoal text-center mb-4">
            Come funziona
          </h2>
          <p className="text-sage text-center mb-12 max-w-xl mx-auto">
            Confronta. Ordina. Risparmia. In tre semplici passi.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Search,
                step: "01",
                title: "Cerca e Confronta",
                description:
                  "Cerca qualsiasi prodotto e confronta prezzi da tutti i fornitori della tua zona in un colpo solo.",
              },
              {
                icon: ShoppingCart,
                step: "02",
                title: "Aggiungi al Carrello",
                description:
                  "Seleziona i migliori prezzi da fornitori diversi. Il carrello smart raggruppa tutto automaticamente.",
              },
              {
                icon: TrendingDown,
                step: "03",
                title: "Risparmia",
                description:
                  "Ricevi alert quando i prezzi scendono e scopri alternative piu convenienti per i tuoi prodotti abituali.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-cream rounded-2xl p-8 text-center"
              >
                <div className="inline-flex items-center justify-center w-14 h-14 bg-forest-light rounded-xl mb-4">
                  <item.icon className="h-7 w-7 text-forest" />
                </div>
                <div className="text-xs font-mono text-sage mb-2 uppercase tracking-widest">
                  Passo {item.step}
                </div>
                <h3 className="text-xl font-bold text-charcoal mb-3">
                  {item.title}
                </h3>
                <p className="text-sage leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto bg-forest rounded-3xl p-12 text-center">
          <h2 className="text-3xl font-display text-white mb-4">
            Pronto a risparmiare sui tuoi ordini?
          </h2>
          <p className="text-forest-light text-lg mb-8 max-w-xl mx-auto">
            Unisciti a centinaia di ristoratori che hanno gia scelto GastroBridge
            per gestire i loro fornitori.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-white text-forest hover:bg-cream"
              >
                Registrati Gratis
              </Button>
            </Link>
            <Link href="/signup?role=supplier">
              <Button
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto border-white text-white hover:bg-white hover:text-forest"
              >
                Sei un Fornitore?
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-sage-muted/30">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center">
            <span className="text-lg font-display text-charcoal">Gastro</span>
            <span className="text-lg font-body font-bold text-forest">
              Bridge
            </span>
          </div>
          <p className="text-sm text-sage">
            &copy; {new Date().getFullYear()} GastroBridge. Tutti i diritti
            riservati.
          </p>
        </div>
      </footer>
    </main>
  );
}
