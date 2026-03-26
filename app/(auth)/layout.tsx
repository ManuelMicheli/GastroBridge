import type { ReactNode } from "react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl">
              <span className="font-display text-charcoal">Gastro</span>
              <span className="font-body font-bold text-forest">Bridge</span>
            </h1>
          </Link>
          <p className="mt-2 text-sage text-sm">
            Tutti i tuoi fornitori. Un solo posto.
          </p>
        </div>

        {children}
      </div>
    </div>
  );
}
