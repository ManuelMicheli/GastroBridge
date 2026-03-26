import Link from "next/link";

const FOOTER_LINKS = {
  Piattaforma: [
    { href: "/pricing", label: "Prezzi" },
    { href: "/signup", label: "Registrati" },
    { href: "/login", label: "Accedi" },
  ],
  Fornitori: [
    { href: "/per-fornitori", label: "Diventa Fornitore" },
    { href: "/pricing", label: "Piani Fornitore" },
  ],
  Legale: [
    { href: "#", label: "Privacy Policy" },
    { href: "#", label: "Termini di Servizio" },
    { href: "#", label: "Cookie Policy" },
  ],
};

export function Footer() {
  return (
    <footer className="bg-charcoal text-white py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div>
            <Link href="/" className="inline-block mb-4">
              <span className="text-2xl font-display text-white">Gastro</span>
              <span className="text-2xl font-body font-bold text-forest-light">Bridge</span>
            </Link>
            <p className="text-sage text-sm leading-relaxed">
              Il marketplace B2B che connette ristoratori e fornitori Ho.Re.Ca. nel Nord Italia.
            </p>
          </div>

          {/* Links */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-bold text-sm uppercase tracking-wider text-sage mb-4">
                {title}
              </h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-sage-muted hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-sage">
            &copy; {new Date().getFullYear()} GastroBridge. Tutti i diritti riservati.
          </p>
          <p className="text-xs text-sage">
            Made with love in Italia
          </p>
        </div>
      </div>
    </footer>
  );
}
