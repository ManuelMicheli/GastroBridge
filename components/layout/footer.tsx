import Link from "next/link";

const FOOTER_LINKS: Record<string, { href: string; label: string }[]> = {
  Piattaforma: [
    { href: "#come-funziona", label: "Come funziona" },
    { href: "/per-fornitori", label: "Per i fornitori" },
    { href: "/pricing", label: "Prezzi" },
    { href: "#faq", label: "Domande" },
  ],
  Risorse: [
    { href: "#", label: "Centro assistenza" },
    { href: "#", label: "Blog" },
    { href: "#", label: "API" },
    { href: "#", label: "Status" },
  ],
  Legale: [
    { href: "#", label: "Privacy" },
    { href: "#", label: "Termini" },
    { href: "#", label: "Cookie" },
    { href: "#", label: "P.IVA" },
  ],
};

export function Footer() {
  return (
    <footer
      className="relative"
      style={{
        background: "var(--color-marketing-bg)",
        paddingLeft: "var(--gutter-marketing)",
        paddingRight: "var(--gutter-marketing)",
        paddingTop: "clamp(80px, 10vw, 144px)",
        paddingBottom: "clamp(48px, 6vw, 96px)",
      }}
    >
      <hr
        className="absolute top-0 left-[var(--gutter-marketing)] right-[var(--gutter-marketing)]"
        style={{ borderTop: "1px solid var(--color-marketing-rule-strong)", borderLeft: 0, borderRight: 0, borderBottom: 0 }}
      />

      <div className="mx-auto max-w-[1400px]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-y-16 lg:gap-x-10">
          {/* Oversized wordmark (col 1-6) */}
          <div className="lg:col-span-6">
            <Link
              href="/"
              className="inline-flex items-baseline gap-[2px] font-display leading-none text-[var(--color-marketing-ink)]"
              style={{ fontSize: "clamp(48px, 7vw, 96px)", letterSpacing: "-0.02em" }}
              aria-label="GastroBridge"
            >
              <span>Gastro</span>
              <span className="font-body font-semibold">Bridge</span>
            </Link>
            <p
              className="mt-8 max-w-[40ch] text-[var(--color-marketing-ink-muted)]"
              style={{ fontSize: "var(--type-marketing-body)", lineHeight: "var(--type-marketing-body-lh)" }}
            >
              La rete italiana che unisce chi cucina a chi rifornisce. Senza intermediari.
            </p>
          </div>

          {/* Link columns (col 7-12, 3 columns) */}
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-3 gap-10">
            {Object.entries(FOOTER_LINKS).map(([title, links]) => (
              <div key={title}>
                <p
                  className="font-mono uppercase mb-5 text-[var(--color-marketing-ink-subtle)]"
                  style={{
                    fontSize: "var(--type-marketing-eyebrow)",
                    letterSpacing: "var(--type-marketing-eyebrow-ls)",
                  }}
                >
                  {title}
                </p>
                <ul className="space-y-3">
                  {links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-[var(--color-marketing-ink-muted)] hover:text-[var(--color-marketing-primary)] transition-colors link-editorial"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <hr
          className="mt-20 mb-8"
          style={{ borderTop: "1px solid var(--color-marketing-rule)", borderLeft: 0, borderRight: 0, borderBottom: 0 }}
        />

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-10">
          <span
            aria-hidden
            className="block h-px"
            style={{ width: "48px", background: "var(--color-marketing-primary)" }}
          />
          <p
            className="font-mono uppercase text-[var(--color-marketing-ink-subtle)]"
            style={{
              fontSize: "var(--type-marketing-eyebrow)",
              letterSpacing: "var(--type-marketing-eyebrow-ls)",
            }}
          >
            © {new Date().getFullYear()} GastroBridge — Milano, Italia. P.IVA ________
          </p>
        </div>
      </div>
    </footer>
  );
}
