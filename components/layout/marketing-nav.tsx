"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils/formatters";
import { gsap } from "@/lib/gsap-config";

const NAV_LINKS = [
  { href: "#come-funziona", label: "Come Funziona", type: "anchor" as const },
  { href: "#per-chi", label: "Per Chi", type: "anchor" as const },
  { href: "/pricing", label: "Prezzi", type: "page" as const },
  { href: "#faq", label: "FAQ", type: "anchor" as const },
];

export function MarketingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 40);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sectionIds = NAV_LINKS.filter((l) => l.type === "anchor").map((l) =>
      l.href.replace("#", "")
    );
    const observers: IntersectionObserver[] = [];
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) setActiveSection(id);
        },
        { rootMargin: "-40% 0px -40% 0px" }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  function handleAnchorClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    e.preventDefault();
    setMobileOpen(false);
    const target = document.querySelector(href);
    if (target) {
      gsap.to(window, {
        scrollTo: { y: target, offsetY: 80 },
        duration: 0.9,
        ease: "power3.inOut",
      });
    }
  }

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all",
        scrolled
          ? "h-16 bg-[var(--color-marketing-bg)]/85 backdrop-blur-xl border-b border-[var(--color-marketing-rule)]"
          : "h-20 bg-transparent"
      )}
      style={{ transitionDuration: "300ms", transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
    >
      <div
        className="mx-auto flex items-center justify-between h-full"
        style={{ paddingLeft: "var(--gutter-marketing)", paddingRight: "var(--gutter-marketing)" }}
      >
        <Link href="/" className="flex items-baseline gap-px" aria-label="GastroBridge, torna alla home">
          <span className="text-xl font-display text-[var(--color-marketing-ink)]">Gastro</span>
          <span className="text-xl font-body font-semibold text-[var(--color-marketing-ink)]">Bridge</span>
        </Link>

        <div className="hidden md:flex items-center gap-10">
          {NAV_LINKS.map((link) => {
            const isActive = activeSection === link.href.replace("#", "");
            const base =
              "relative text-[13px] tracking-wide transition-colors link-editorial";
            const tone = isActive
              ? "text-[var(--color-marketing-ink)]"
              : "text-[var(--color-marketing-ink-muted)] hover:text-[var(--color-marketing-primary)]";
            return link.type === "anchor" ? (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleAnchorClick(e, link.href)}
                className={cn(base, tone)}
              >
                {link.label}
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute left-0 -bottom-1 h-px w-full bg-[var(--color-marketing-primary)]"
                  />
                )}
              </a>
            ) : (
              <Link key={link.href} href={link.href} className={cn(base, tone)}>
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden md:flex items-center gap-6">
          <Link
            href="/login"
            className="text-[13px] tracking-wide text-[var(--color-marketing-ink-muted)] hover:text-[var(--color-marketing-primary)] link-editorial"
          >
            Accedi
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center rounded-full px-5 py-2.5 text-[13px] tracking-wide transition-colors"
            style={{
              background: "var(--color-marketing-primary)",
              color: "var(--color-marketing-on-primary)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--color-marketing-primary-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--color-marketing-primary)";
            }}
          >
            Apri un account
          </Link>
        </div>

        <button
          className="md:hidden p-2 text-[var(--color-marketing-ink)]"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Chiudi menu" : "Apri menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 top-16 z-40 flex flex-col items-start justify-start gap-6 overflow-y-auto"
          style={{
            background: "var(--color-marketing-bg)",
            paddingLeft: "var(--gutter-marketing)",
            paddingRight: "var(--gutter-marketing)",
            paddingTop: "clamp(32px, 6vw, 64px)",
            paddingBottom: "clamp(48px, 8vw, 96px)",
          }}
        >
          <p
            className="font-mono uppercase tracking-[0.22em] text-[11px] text-[var(--color-marketing-ink-subtle)]"
          >
            MENU — N.00
          </p>
          {NAV_LINKS.map((link) =>
            link.type === "anchor" ? (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleAnchorClick(e, link.href)}
                className="font-display text-[clamp(32px,7vw,56px)] leading-[1.02] text-[var(--color-marketing-ink)] hover:text-[var(--color-marketing-primary)] transition-colors"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="font-display text-[clamp(32px,7vw,56px)] leading-[1.02] text-[var(--color-marketing-ink)] hover:text-[var(--color-marketing-primary)] transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            )
          )}
          <hr className="rule w-full mt-6" />
          <div className="flex flex-col gap-3 mt-4 w-full">
            <Link
              href="/signup"
              onClick={() => setMobileOpen(false)}
              className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm tracking-wide"
              style={{
                background: "var(--color-marketing-primary)",
                color: "var(--color-marketing-on-primary)",
              }}
            >
              Apri un account
            </Link>
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="inline-flex items-center justify-center px-6 py-3 text-sm tracking-wide text-[var(--color-marketing-ink-muted)] link-editorial self-start"
            >
              Accedi
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
