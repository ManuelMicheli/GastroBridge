import Link from "next/link";

const FOOTER_LINKS = {
  Piattaforma: [
    { href: "#come-funziona", label: "Come Funziona" },
    { href: "#per-chi", label: "Per Ristoratori" },
    { href: "#per-chi", label: "Per Fornitori" },
    { href: "/pricing", label: "Prezzi" },
  ],
  Risorse: [
    { href: "#", label: "Centro Assistenza" },
    { href: "#", label: "Blog" },
    { href: "#", label: "API Documentation" },
    { href: "#", label: "Status" },
  ],
  Legale: [
    { href: "#", label: "Privacy Policy" },
    { href: "#", label: "Termini di Servizio" },
    { href: "#", label: "Cookie Policy" },
    { href: "#", label: "P.IVA" },
  ],
};

export function Footer() {
  return (
    <footer className="bg-charcoal py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div>
            <Link href="/" className="inline-block mb-4">
              <span className="text-2xl font-display text-cream/90">Gastro</span>
              <span className="text-2xl font-body font-bold text-accent-green">Bridge</span>
            </Link>
            <p className="text-cream/50 text-sm leading-relaxed font-body">
              Il marketplace B2B che connette ristoratori e fornitori Ho.Re.Ca. nel Nord Italia.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-semibold text-sm uppercase tracking-[0.15em] text-cream/40 mb-4 font-body">
                {title}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-cream/50 hover:text-cream transition-colors duration-200 font-body"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-cream/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-cream/30 font-body">
            &copy; {new Date().getFullYear()} GastroBridge. Tutti i diritti riservati.
          </p>
        </div>
      </div>
    </footer>
  );
}
